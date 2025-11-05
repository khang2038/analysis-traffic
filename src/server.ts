import express from 'express';
import cors from 'cors';
import path from 'path';
import session from 'express-session';
import dotenv from 'dotenv';
import {OAuth2Client} from 'google-auth-library';
import {fetchEmployeeReport, fetchLeaderboard, fetchEmployeeReportByAlias, fetchLeaderboardByAlias, parseSitesEnv, SiteProperty} from './ga';
import {loadAliasMapFromEnv, loadDefaultAliasMapFromEnv} from './alias';

dotenv.config();

// Debug: log env variables
// eslint-disable-next-line no-console
console.log('=== ENV DEBUG ===');
// eslint-disable-next-line no-console
console.log('GA4_SITES:', process.env.GA4_SITES);
// eslint-disable-next-line no-console
console.log('GA_SERVICE_ACCOUNT_JSON:', process.env.GA_SERVICE_ACCOUNT_JSON ? 'SET (file path)' : 'NOT SET');
// eslint-disable-next-line no-console
console.log('PORT:', process.env.PORT || '3000 (default)');
// eslint-disable-next-line no-console
console.log('ALIAS_MAP:', process.env.ALIAS_MAP ? 'SET' : 'NOT SET');
// eslint-disable-next-line no-console
console.log('DEFAULT_MODE:', process.env.DEFAULT_MODE || 'alias (default)');
// eslint-disable-next-line no-console
console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS || 'NOT SET');
// eslint-disable-next-line no-console
console.log('==================');

const app = express();
app.use(cors());
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { sameSite: 'lax' }
}));

const sites: SiteProperty[] = parseSitesEnv(process.env.GA4_SITES);
const employeeDimension = process.env.GA4_EMPLOYEE_DIMENSION || 'customUser:employee_id';
const aliasMap = loadAliasMapFromEnv();
const defaultMode = (process.env.DEFAULT_MODE || 'alias') as 'alias' | 'employee';
const defaultAliasMap = loadDefaultAliasMapFromEnv();

app.get('/api/sites', (_req, res) => {
  res.json({sites});
});

app.get('/api/aliasMap', (_req, res) => {
  // eslint-disable-next-line no-console
  console.log('ALIAS_MAP endpoint called, returning:', JSON.stringify(aliasMap, null, 2));
  res.json({aliasMap});
});

app.get('/api/defaultAlias', (req, res) => {
  const propertyId = String(req.query.propertyId || '');
  if (!propertyId) return res.json({alias: ''});
  const byEnv = defaultAliasMap[propertyId];
  if (byEnv) return res.json({alias: byEnv});
  const map = aliasMap[propertyId] || {};
  const first = Object.keys(map)[0] || '';
  return res.json({alias: first});
});

app.get('/api/report', async (req, res) => {
  try {
    const propertyId = String(req.query.propertyId || '');
    const employeeId = String(req.query.employeeId || '');
    const alias = String(req.query.alias || '');
    const startDate = String(req.query.startDate || '30daysAgo');
    const endDate = String(req.query.endDate || 'today');
    const mode = String(req.query.mode || defaultMode);

    if (!propertyId) return res.status(400).json({error: 'Missing propertyId'});
    // Build GA client: service account (default) or OAuth if available
    const client = buildAnalyticsClientFromSession(req.session as any);

    if (mode === 'alias') {
      if (!alias) return res.status(400).json({error: 'Missing alias'});
      const report = await fetchEmployeeReportByAlias({
        propertyId,
        alias,
        startDate,
        endDate,
        aliasToEmployee: aliasMap[propertyId]
      }, client);
      return res.json(report);
    }

    if (!employeeId) return res.status(400).json({error: 'Missing employeeId'});

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

app.get('/api/leaderboard/all', async (req, res) => {
  try {
    const startDate = String(req.query.startDate || '30daysAgo');
    const endDate = String(req.query.endDate || 'today');
    const orderMetric = String(req.query.orderMetric || 'screenPageViews');
    const mode = String(req.query.mode || defaultMode);

    // eslint-disable-next-line no-console
    console.log('LEADERBOARD_ALL_REQUEST:', { startDate, endDate, mode, totalSites: sites.length });

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

    // Lấy dữ liệu từ tất cả sites
    for (const site of sites) {
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
          // Nếu employeeId là employee name, giữ nguyên
          const siteAliasMap = aliasMap[site.id] || {};
          const employeeName = siteAliasMap[employeeId];
          if (employeeName) {
            // employeeId là alias, dùng employee name
            employeeId = employeeName;
          } else {
            // Check xem employeeId có phải là employee name không (ngược lại trong map)
            const foundAlias = Object.keys(siteAliasMap).find(alias => siteAliasMap[alias] === employeeId);
            if (foundAlias) {
              // employeeId là employee name, giữ nguyên
              // employeeId = employeeId
            } else {
              // Không có trong map, có thể là alias hoặc employee name, giữ nguyên
              // employeeId = employeeId
            }
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
    }

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
    .map((row, idx) => ({...row, rank: idx + 1}));

    // eslint-disable-next-line no-console
    console.log('LEADERBOARD_ALL_RESPONSE:', { totalRows: rows.length, firstFew: rows.slice(0, 5) });
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

    // eslint-disable-next-line no-console
    console.log('LEADERBOARD_REQUEST:', { propertyId, startDate, endDate, mode, aliasMapForProperty: aliasMap[propertyId] });

    if (!propertyId) return res.status(400).json({error: 'Missing propertyId'});
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
    // eslint-disable-next-line no-console
    console.log('LEADERBOARD_RESPONSE:', { totalRows: data.rows?.length || 0, firstFew: data.rows?.slice(0, 5) });
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

// Serve client build if available
const clientDist = path.join(process.cwd(), 'client', 'dist');
app.use(express.static(clientDist));
app.get('/', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ===== OAuth endpoints =====
const oauthClientId = process.env.OAUTH_CLIENT_ID || '';
const oauthClientSecret = process.env.OAUTH_CLIENT_SECRET || '';
const oauthRedirect = process.env.OAUTH_REDIRECT || 'http://localhost:3000/auth/callback';

function getOAuthClient() {
  return new OAuth2Client(oauthClientId, oauthClientSecret, oauthRedirect);
}

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
  const {tokens} = await client.getToken(code);
  (req.session as any).gaTokens = tokens;
  req.session.save(() => res.redirect('/'));
});

app.get('/auth/logout', (req, res) => {
  (req.session as any).gaTokens = undefined;
  res.redirect('/');
});

app.get('/auth/status', async (req, res) => {
  const tokens = (req.session as any).gaTokens;
  res.json({loggedIn: !!tokens});
});

function buildAnalyticsClientFromSession(sess: any) {
  // Priority: service account > OAuth
  // Service account is preferred and configured via GA_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
  // OAuth is only used if service account is not available
  const tokens = sess?.gaTokens;
  if (tokens && oauthClientId && oauthClientSecret) {
    const oauth = getOAuthClient();
    oauth.setCredentials(tokens);
    const {BetaAnalyticsDataClient} = require('@google-analytics/data');
    return new BetaAnalyticsDataClient({auth: oauth, fallback: true});
  }
  return undefined; // Will use service account from newClient() in ga.ts
}

app.get('/auth/whoami', async (req, res) => {
  try {
    const tokens = (req.session as any).gaTokens;
    if (!tokens) return res.status(401).json({loggedIn: false});
    const oauth = getOAuthClient();
    oauth.setCredentials(tokens);
    const r = await oauth.request({
      url: 'https://www.googleapis.com/oauth2/v2/userinfo'
    });
    res.json({loggedIn: true, user: r.data});
  } catch (e: any) {
    res.status(500).json({error: e?.message || 'whoami_failed'});
  }
});

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


