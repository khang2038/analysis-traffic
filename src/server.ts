import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import session from 'express-session';
import dotenv from 'dotenv';
import { OAuth2Client } from 'google-auth-library';
import { fetchEmployeeReport, fetchLeaderboard, fetchEmployeeReportByAlias, fetchLeaderboardByAlias, fetchRealtimeReport, parseSitesEnv, SiteProperty, fetchTrendRadarData } from './ga';
import { loadAliasMapFromEnv, loadDefaultAliasMapFromEnv, loadGroupsFromEnv } from './alias';
import { DataCollectorService } from './services/dataCollector';
import { TrendDetectionService } from './services/trendDetection';
import { AIRecommendationService } from './services/aiRecommendation';
import { CronJobs } from './cron/collector';
import prisma from './db/client';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.text({ limit: '100mb' }));

// Only use session if OAuth is configured (otherwise use service account)
const oauthClientId = process.env.OAUTH_CLIENT_ID || '';
const oauthClientSecret = process.env.OAUTH_CLIENT_SECRET || '';
const useOAuth = oauthClientId && oauthClientSecret;

if (useOAuth) {
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { sameSite: 'lax' }
  }));
} else {
}

const sites: SiteProperty[] = parseSitesEnv(process.env.GA4_SITES);
const employeeDimension = process.env.GA4_EMPLOYEE_DIMENSION || 'customUser:employee_id';
const aliasMap = loadAliasMapFromEnv();
const defaultMode = (process.env.DEFAULT_MODE || 'alias') as 'alias' | 'employee';
const defaultAliasMap = loadDefaultAliasMapFromEnv();
const groupsMap = loadGroupsFromEnv();

app.get('/api/sites', (_req, res) => {
  res.json({ sites });
});

app.get('/api/aliasMap', (_req, res) => {
  res.json({ aliasMap });
});

app.get('/api/groups', (_req, res) => {
  res.json({ groups: groupsMap });
});

app.get('/api/defaultAlias', (req, res) => {
  const propertyId = String(req.query.propertyId || '');
  if (!propertyId) return res.json({ alias: '' });
  const byEnv = defaultAliasMap[propertyId];
  if (byEnv) return res.json({ alias: byEnv });
  const map = aliasMap[propertyId] || {};
  const first = Object.keys(map)[0] || '';
  return res.json({ alias: first });
});

app.get('/api/report', async (req, res) => {
  try {
    const propertyId = String(req.query.propertyId || '');
    const employeeId = String(req.query.employeeId || '');
    const alias = String(req.query.alias || '');
    const startDate = String(req.query.startDate || '30daysAgo');
    const endDate = String(req.query.endDate || 'today');
    const mode = String(req.query.mode || defaultMode);

    if (!propertyId) return res.status(400).json({ error: 'Missing propertyId' });
    // Build GA client: service account (default) or OAuth if available
    const client = buildAnalyticsClientFromSession(req.session as any);

    if (mode === 'alias') {
      if (!alias) return res.status(400).json({ error: 'Missing alias' });
      const report = await fetchEmployeeReportByAlias({
        propertyId,
        alias,
        startDate,
        endDate,
        aliasToEmployee: aliasMap[propertyId]
      }, client);
      return res.json(report);
    }

    if (!employeeId) return res.status(400).json({ error: 'Missing employeeId' });

    const report = await fetchEmployeeReport({
      propertyId,
      employeeDimension,
      employeeId,
      startDate,
      endDate
    }, client);
    res.json(report);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('REPORT_ERROR', err);
    res.status(500).json({
      error: err?.message || 'Unknown error',
      details: err?.response?.data || err?.errors || undefined
    });
  }
});

const realtimeCache: Record<string, { timestamp: number; data: any }> = {};
const REALTIME_CACHE_TTL = 60 * 1000; // 60 seconds

app.get('/api/realtime', async (req, res) => {
  try {
    const propertyId = String(req.query.propertyId || '');
    if (!propertyId) return res.status(400).json({ error: 'Missing propertyId' });

    const now = Date.now();
    const cached = realtimeCache[propertyId];
    if (cached && (now - cached.timestamp < REALTIME_CACHE_TTL)) {
      return res.json(cached.data);
    }

    const client = buildAnalyticsClientFromSession(req.session as any);
    const report = await fetchRealtimeReport(propertyId, client);

    realtimeCache[propertyId] = {
      timestamp: Date.now(),
      data: report
    };

    res.json(report);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('REALTIME_ERROR', err);
    res.status(500).json({
      error: err?.message || 'Unknown error',
      details: err?.response?.data || err?.errors || undefined
    });
  }
});

app.get('/api/leaderboard/all', async (req, res) => {
  try {
    const startDate = String(req.query.startDate || '30daysAgo');
    const endDate = String(req.query.endDate || 'today');
    const orderMetric = String(req.query.orderMetric || 'screenPageViews');
    const mode = String(req.query.mode || defaultMode);

    // Build GA client: service account (default) or OAuth if available
    const client = buildAnalyticsClientFromSession(req.session as any);

    // Aggregate từ tất cả sites
    const allRows: Array<{
      employeeId: string;
      activeUsers: number;
      sessions: number;
      screenPageViews: number;
      viewsPerActiveUser: number;
      averageEngagementTime: number;
      eventCount: number;
      conversions: number;
      totalRevenue: number;
      rank: number;
    }> = [];

    const employeeMap: Record<string, {
      activeUsers: number;
      sessions: number;
      screenPageViews: number;
      totalEngagementTime: number;
      eventCount: number;
      conversions: number;
      totalRevenue: number;
    }> = {};

    // Lấy dữ liệu từ tất cả sites song song để tránh timeout
    await Promise.all(sites.map(async (site) => {
      try {
        const data = mode === 'alias'
          ? await fetchLeaderboardByAlias({
            propertyId: site.id,
            startDate,
            endDate,
            orderMetric: orderMetric as any,
            aliasToEmployee: aliasMap[site.id]
          }, client)
          : await fetchLeaderboard({
            propertyId: site.id,
            employeeDimension,
            startDate,
            endDate,
            orderMetric: orderMetric as any
          }, client);

        // Aggregate theo employeeId (normalize để đảm bảo cùng employee name được aggregate lại)
        for (const row of data.rows || []) {
          let employeeId = row.employeeId;

          // Normalize: nếu employeeId là alias, tìm employee name từ aliasMap của site này
          const siteAliasMap = aliasMap[site.id] || {};
          const employeeName = siteAliasMap[employeeId];
          if (employeeName) {
            employeeId = employeeName;
          }

          if (!employeeMap[employeeId]) {
            employeeMap[employeeId] = {
              activeUsers: 0,
              sessions: 0,
              screenPageViews: 0,
              totalEngagementTime: 0,
              eventCount: 0,
              conversions: 0,
              totalRevenue: 0
            };
          }
          employeeMap[employeeId].activeUsers += row.activeUsers;
          employeeMap[employeeId].sessions += row.sessions;
          employeeMap[employeeId].screenPageViews += row.screenPageViews;
          employeeMap[employeeId].totalEngagementTime += (row.averageEngagementTime || 0) * row.activeUsers;
          employeeMap[employeeId].eventCount += row.eventCount || 0;
          employeeMap[employeeId].conversions += row.conversions || 0;
          employeeMap[employeeId].totalRevenue += row.totalRevenue || 0;
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error(`Error fetching leaderboard for site ${site.id}:`, err);
        // Continue with other sites
      }
    }));

    // Convert to rows array
    const rows = Object.entries(employeeMap).map(([employeeId, data]) => ({
      employeeId,
      activeUsers: data.activeUsers,
      sessions: data.sessions,
      screenPageViews: data.screenPageViews,
      viewsPerActiveUser: data.activeUsers > 0 ? data.screenPageViews / data.activeUsers : 0,
      averageEngagementTime: data.activeUsers > 0 ? data.totalEngagementTime / data.activeUsers : 0,
      eventCount: data.eventCount,
      conversions: data.conversions,
      totalRevenue: data.totalRevenue,
      rank: 0
    }))
      .sort((a, b) => (b[orderMetric as keyof typeof b] as number) - (a[orderMetric as keyof typeof a] as number))
      .map((row, idx) => ({ ...row, rank: idx + 1 }));

    res.json({
      rows,
      totalEmployees: rows.length,
      metricSorted: orderMetric
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('LEADERBOARD_ALL_ERROR', err);
    res.status(500).json({
      error: err?.message || 'Unknown error',
      details: err?.response?.data || err?.errors || undefined
    });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const propertyId = String(req.query.propertyId || '');
    const startDate = String(req.query.startDate || '30daysAgo');
    const endDate = String(req.query.endDate || 'today');
    const orderMetric = String(req.query.orderMetric || 'screenPageViews');
    const mode = String(req.query.mode || defaultMode);

    if (!propertyId) return res.status(400).json({ error: 'Missing propertyId' });
    // Build GA client: service account (default) or OAuth if available
    const client = buildAnalyticsClientFromSession(req.session as any);
    const data = mode === 'alias'
      ? await fetchLeaderboardByAlias({
        propertyId,
        startDate,
        endDate,
        orderMetric: orderMetric as any,
        aliasToEmployee: aliasMap[propertyId]
      }, client)
      : await fetchLeaderboard({
        propertyId,
        employeeDimension,
        startDate,
        endDate,
        orderMetric: orderMetric as any
      }, client);
    res.json(data);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('LEADERBOARD_ERROR', err);
    res.status(500).json({
      error: err?.message || 'Unknown error',
      details: err?.response?.data || err?.errors || undefined
    });
  }
});

// ===== AI & Analytics API Endpoints =====

// GET /api/trends - Lấy trending topics
app.get('/api/trends', async (req, res) => {
  try {
    const propertyId = String(req.query.propertyId || '');
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const days = parseInt(String(req.query.days || '7'), 10);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const trends = await prisma.contentTrend.findMany({
      where: {
        ...(propertyId ? { propertyId } : {}),
        detectedAt: {
          gte: since,
        },
      },
      orderBy: {
        momentumScore: 'desc',
      },
      take: limit,
    });

    res.json({ trends });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('TRENDS_ERROR', err);
    res.status(500).json({
      error: err?.message || 'Unknown error',
    });
  }
});

// GET /api/recommendations - Lấy AI content recommendations
app.get('/api/recommendations', async (req, res) => {
  try {
    const propertyId = String(req.query.propertyId || '');
    const limit = parseInt(String(req.query.limit || '10'), 10);

    if (!propertyId) {
      return res.status(400).json({ error: 'Missing propertyId' });
    }

    const aiService = new AIRecommendationService();
    const recommendations = await aiService.generateRecommendations(propertyId, limit);

    res.json({ recommendations });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('RECOMMENDATIONS_ERROR', err);
    res.status(500).json({
      error: err?.message || 'Unknown error',
    });
  }
});

// GET /api/reader-behavior - Phân tích hành vi người đọc
app.get('/api/reader-behavior', async (req, res) => {
  try {
    const propertyId = String(req.query.propertyId || '');
    const days = parseInt(String(req.query.days || '30'), 10);

    if (!propertyId) {
      return res.status(400).json({ error: 'Missing propertyId' });
    }

    const aiService = new AIRecommendationService();
    const patterns = await aiService.analyzeReaderBehavior(propertyId, days);

    res.json({ patterns });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('READER_BEHAVIOR_ERROR', err);
    res.status(500).json({
      error: err?.message || 'Unknown error',
    });
  }
});

// GET /api/spikes - Detect traffic spikes
app.get('/api/spikes', async (req, res) => {
  try {
    const propertyId = String(req.query.propertyId || '');
    const threshold = parseInt(String(req.query.threshold || '200'), 10);

    if (!propertyId) {
      return res.status(400).json({ error: 'Missing propertyId' });
    }

    const trendDetector = new TrendDetectionService();
    const spikes = await trendDetector.detectSpikes(propertyId, threshold);

    res.json({ spikes });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('SPIKES_ERROR', err);
    res.status(500).json({
      error: err?.message || 'Unknown error',
    });
  }
});

// POST /api/collect - Manual trigger data collection
app.post('/api/collect', async (req, res) => {
  try {
    const propertyId = String(req.body.propertyId || '');
    const dateStr = String(req.body.date || '');

    const collector = new DataCollectorService();
    let results: Record<string, number>;

    if (propertyId && dateStr) {
      const date = new Date(dateStr);
      const count = await collector.collectSnapshotForProperty(propertyId, date);
      results = { [propertyId]: count };
    } else {
      const date = dateStr ? new Date(dateStr) : new Date();
      results = await collector.collectAllSnapshots(date);
    }

    res.json({ success: true, results });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('COLLECT_ERROR', err);
    res.status(500).json({
      error: err?.message || 'Unknown error',
    });
  }
});

// POST /api/analyze-trends - Manual trigger trend analysis
app.post('/api/analyze-trends', async (req, res) => {
  try {
    const propertyId = String(req.body.propertyId || '');
    const weekStartStr = String(req.body.weekStart || '');
    const weekEndStr = String(req.body.weekEnd || '');

    if (!propertyId) {
      return res.status(400).json({ error: 'Missing propertyId' });
    }

    const weekStart = weekStartStr ? new Date(weekStartStr) : new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekEnd = weekEndStr ? new Date(weekEndStr) : new Date();

    const trendDetector = new TrendDetectionService();
    const trends = await trendDetector.detectTrends(propertyId, weekStart, weekEnd);

    res.json({ success: true, trends });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('ANALYZE_TRENDS_ERROR', err);
    res.status(500).json({
      error: err?.message || 'Unknown error',
    });
  }
});

// GET /api/alerts - Lấy alerts
app.get('/api/alerts', async (req, res) => {
  try {
    const propertyId = String(req.query.propertyId || '');
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const acknowledged = req.query.acknowledged === 'true';

    const alerts = await prisma.trendAlert.findMany({
      where: {
        ...(propertyId ? { propertyId } : {}),
        ...(acknowledged !== undefined ? { acknowledged } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    res.json({ alerts });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('ALERTS_ERROR', err);
    res.status(500).json({
      error: err?.message || 'Unknown error',
    });
  }
});

// Serve client build if available
const clientDist = path.join(process.cwd(), 'client', 'dist');
const indexHtmlPath = path.join(clientDist, 'index.html');

if (fs.existsSync(clientDist) && fs.existsSync(indexHtmlPath)) {
  app.use(express.static(clientDist));
  app.get('/', (_req, res) => {
    res.sendFile(indexHtmlPath);
  });
  // eslint-disable-next-line no-console
  console.log('Client build found, serving static files from:', clientDist);
} else {
  // eslint-disable-next-line no-console
  console.warn('Client build not found at:', clientDist, '- API endpoints are still available');
  app.get('/', (_req, res) => {
    res.json({
      message: 'API server is running. Client build not found. Please run: npm run build:client',
      endpoints: {
        sites: '/api/sites',
        aliasMap: '/api/aliasMap',
        leaderboard: '/api/leaderboard',
        leaderboardAll: '/api/leaderboard/all',
        report: '/api/report'
      }
    });
  });
}

// ===== OAuth endpoints =====
const oauthRedirect = process.env.OAUTH_REDIRECT || 'http://localhost:3000/auth/callback';

function getOAuthClient() {
  return new OAuth2Client(oauthClientId, oauthClientSecret, oauthRedirect);
}

// Only register OAuth endpoints if OAuth is configured
if (useOAuth) {
  app.get('/auth/login', (req, res) => {
    const client = getOAuthClient();
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/analytics.readonly',
        'openid',
        'email',
        'profile'
      ]
    });
    res.redirect(url);
  });

  app.get('/auth/callback', async (req, res) => {
    const code = String(req.query.code || '');
    if (!code) return res.status(400).send('Missing code');
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    (req.session as any).gaTokens = tokens;
    req.session.save(() => res.redirect('/'));
  });

  app.get('/auth/logout', (req, res) => {
    (req.session as any).gaTokens = undefined;
    res.redirect('/');
  });

  app.get('/auth/status', async (req, res) => {
    const tokens = (req.session as any).gaTokens;
    res.json({ loggedIn: !!tokens });
  });

  app.get('/auth/whoami', async (req, res) => {
    try {
      const tokens = (req.session as any).gaTokens;
      if (!tokens) return res.status(401).json({ loggedIn: false });
      const oauth = getOAuthClient();
      oauth.setCredentials(tokens);
      const r = await oauth.request({
        url: 'https://www.googleapis.com/oauth2/v2/userinfo'
      });
      res.json({ loggedIn: true, user: r.data });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'whoami_failed' });
    }
  });
}

function buildAnalyticsClientFromSession(sess: any) {
  // Priority: service account > OAuth
  // Service account is preferred and configured via GA_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
  // OAuth is only used if service account is not available
  if (!useOAuth) return undefined;
  const tokens = sess?.gaTokens;
  if (tokens && oauthClientId && oauthClientSecret) {
    const oauth = getOAuthClient();
    oauth.setCredentials(tokens);
    const { BetaAnalyticsDataClient } = require('@google-analytics/data');
    return new BetaAnalyticsDataClient({ auth: oauth, fallback: true });
  }
  return undefined; // Will use service account from newClient() in ga.ts
}

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Initialize cron jobs (chỉ chạy nếu có DATABASE_URL)
if (process.env.DATABASE_URL) {
  try {
    const cronJobs = new CronJobs();
    cronJobs.startAll();
    // eslint-disable-next-line no-console
    console.log('[Server] Cron jobs initialized');
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.warn('[Server] Failed to initialize cron jobs:', error.message);
  }
} else {
  // eslint-disable-next-line no-console
  console.warn('[Server] DATABASE_URL not set, cron jobs disabled');
}

// GET /api/ai/trends/radar - Dữ liệu cho Trend Radar Dashboard
app.get('/api/ai/trends/radar', async (req, res) => {
  try {
    const propertyId = String(req.query.propertyId || '');

    // Lấy data từ GA4
    const client = buildAnalyticsClientFromSession(req.session as any);
    const radarData = propertyId
      ? await fetchTrendRadarData(propertyId, client)
      : { heatmap: [], topKeywords: [] };

    // Lấy spike alerts gần đây
    const alerts = await prisma.trendAlert.findMany({
      where: {
        alertType: 'spike',
        ...(propertyId ? { propertyId } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    res.json({ topKeywords: radarData.topKeywords, alerts, heatmap: radarData.heatmap });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ai/coach - Tư vấn chuyên sâu cho nhân viên
app.get('/api/ai/coach', async (req, res) => {
  try {
    const { propertyId, employeeId, alias } = req.query;

    const prompt = `Bạn là một AI Content Coach. Hãy đưa ra 3 lời khuyên ngắn gọn, sắc bén và đầy cảm hứng cho nhân viên ${employeeId || alias} dựa trên hiệu suất traffic của họ trên site ${propertyId}.
    
    Yêu cầu:
    1. Một lời khuyên về chủ đề nội dung (topic).
    2. Một lời khuyên về thời gian đăng bài (timing).
    3. Một lời khuyên về cách cải thiện tương tác người dùng.
    Dùng tiếng Việt, cách hành văn chuyên nghiệp và hiện đại.`;

    const aiProvider = process.env.AI_PROVIDER || 'openai';
    let advice = '';

    if (aiProvider === 'gemini' && process.env.GEMINI_API_KEY) {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel(
        { model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' },
        { apiVersion: 'v1beta' }
      );
      const result = await model.generateContent(prompt);
      advice = result.response.text();
    } else if (process.env.OPENAI_API_KEY) {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
      });
      advice = completion.choices[0]?.message?.content || 'Coach đang bận, hãy thử lại sau!';
    } else {
      advice = 'Vui lòng cấu hình AI API Key để nhận lời khuyên từ Coach.';
    }

    res.json({ advice });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/predict - Dự báo traffic
app.post('/api/ai/predict', async (req, res) => {
  try {
    const { topic, time } = req.body;

    // Logic dự báo giả lập (có thể nâng cấp lên model ML thực thụ sau này)
    // Dựa trên random forest hoặc đơn giản là weighted logic
    const baseViews = Math.floor(Math.random() * 5000) + 1000;
    const timeFactor = (time >= 8 && time <= 11) ? 1.5 : (time >= 20 && time <= 23) ? 1.3 : 0.7;
    const predictedViews = Math.round(baseViews * timeFactor);

    res.json({
      predictedViews,
      confidence: 0.85,
      reason: `Topic '${topic}' có xu hướng engagement cao vào khung giờ ${time}h.`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/analyze - Phân tích tổng quan traffic
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { propertyId, employeeId, alias, data, type } = req.body;

    if (!propertyId && !data) {
      return res.status(400).json({ error: 'Missing propertyId or data' });
    }

    const aiProvider = process.env.AI_PROVIDER || 'openai';
    let prompt = '';

    if (type === 'site') {
      prompt = `Hãy phân tích dữ liệu traffic sau đây của website (Property: ${propertyId}) và đưa ra tư vấn chuyên sâu bằng tiếng Việt:
      ${JSON.stringify(data)}
      
      Yêu cầu TẬP TRUNG VÀO:
      1. Đánh giá ngắn gọn các bài viết/trang đang có hiệu quả tốt nhất hiện tại.
      2. Đưa ra các khuyên cụ thể để CẢI THIỆN chất lượng các bài viết trên web (cách viết tiêu đề, độ sâu nội dung, tối ưu hiển thị, cách giữ chân người đọc).
      3. ĐỀ XUẤT 3-5 chủ đề tin tức nổi bật hoặc xu hướng nóng hổi có liên quan để đội ngũ có thể triển khai bài viết tiếp theo.
      Trả lời mạch lạc, format rõ ràng, ngắn gọn và có tính chuyên môn.`;
    } else {
      prompt = `Hãy phân tích hiệu suất của nhân viên ${employeeId || alias} dựa trên dữ liệu traffic sau và đưa ra nhận xét bằng tiếng Việt:
      ${JSON.stringify(data)}
      
      Yêu cầu:
      1. Đánh giá mức độ đóng góp traffic.
      2. Phân tích thế mạnh của nhân viên này (chủ đề nào họ làm tốt nhất).
      3. Gợi ý hướng phát triển nội dung tiếp theo cho họ.
      Trả lời thân thiện, mang tính xây dựng.`;
    }

    let resultText = '';

    if (aiProvider === 'gemini' && process.env.GEMINI_API_KEY) {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel(
        { model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' },
        { apiVersion: 'v1beta' }
      );
      const result = await model.generateContent(prompt);
      resultText = result.response.text();
    } else if (process.env.OPENAI_API_KEY) {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
      });
      resultText = completion.choices[0]?.message?.content || 'Không có phản hồi từ AI';
    } else {
      resultText = 'Vui lòng cấu hình API Key (Gemini hoặc OpenAI) để sử dụng tính năng này.';
    }

    res.json({ analysis: resultText });
  } catch (err: any) {
    console.error('AI_ANALYZE_ERROR', err);
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
});

// POST /api/ai/summarize-article - Tóm tắt nội dung bài viết bằng AI
app.post('/api/ai/summarize-article', async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'Missing topic' });
    }

    const aiProvider = process.env.AI_PROVIDER || 'openai';
    const prompt = `Bạn là một biên tập viên tin tức. Hãy tóm tắt ngắn gọn báo cáo nội dung hoặc đưa ra dự đoán chuyên sâu diễn biến liên quan đến tiêu đề bài viết sau: "${topic}". Viết bằng tiếng Việt, súc tích (dưới 100 từ), dễ hiểu và mang tính phân tích.`;

    let resultText = '';

    if (aiProvider === 'gemini' && process.env.GEMINI_API_KEY) {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel(
        { model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' },
        { apiVersion: 'v1beta' }
      );
      const result = await model.generateContent(prompt);
      resultText = result.response.text();
    } else if (process.env.OPENAI_API_KEY) {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
      });
      resultText = completion.choices[0]?.message?.content || 'Không có phản hồi từ AI';
    } else {
      resultText = 'Vui lòng cấu hình API Key (Gemini hoặc OpenAI) để sử dụng tính năng tóm tắt này.';
    }

    res.json({ summary: resultText });
  } catch (err: any) {
    console.error('AI_SUMMARIZE_ERROR', err);
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${port}`);
});

// Keep server running
server.on('error', (err: any) => {
  // eslint-disable-next-line no-console
  console.error('Server error:', err);
  if (err.code === 'EADDRINUSE') {
    // eslint-disable-next-line no-console
    console.error(`Port ${port} is already in use. Please kill the process using this port or use a different port.`);
    // eslint-disable-next-line no-console
    console.error(`To find and kill the process: lsof -ti:${port} | xargs kill -9`);
    process.exit(1);
  }
});


