import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../db/client';
import { TrendDetectionService } from './trendDetection';

/**
 * AI Content Recommendation Engine
 * Sử dụng LLM để generate content suggestions
 */
export class AIRecommendationService {
  private openai: OpenAI | null = null;
  private gemini: any | null = null;
  private trendDetector: TrendDetectionService;
  private provider: 'openai' | 'gemini' | 'none' = 'none';

  constructor() {
    this.trendDetector = new TrendDetectionService();

    // Check configuration
    const aiProvider = process.env.AI_PROVIDER || 'openai';

    if (aiProvider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        const genAI = new GoogleGenerativeAI(apiKey);
        this.gemini = genAI.getGenerativeModel(
          { model: process.env.GEMINI_MODEL || 'gemini-flash-latest' },
          { apiVersion: 'v1beta' }
        );
        this.provider = 'gemini';
        console.log('[AI] Using Google Gemini as provider');
      }
    } else {
      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey) {
        this.openai = new OpenAI({ apiKey });
        this.provider = 'openai';
        console.log('[AI] Using OpenAI as provider');
      }
    }

    if (this.provider === 'none') {
      console.warn('No AI API key set (OPENAI_API_KEY or GEMINI_API_KEY), AI recommendations will be limited');
    }
  }

  /**
   * Generate content recommendations dựa trên trending topics
   */
  async generateRecommendations(
    propertyId: string,
    limit: number = 10
  ): Promise<Array<{
    suggestedTitle: string;
    suggestedTopic: string;
    basedOnKeyword: string;
    confidenceScore: number;
    suggestedOutline?: string[];
    suggestedKeywords?: string[];
    metaDescription?: string;
  }>> {
    // Lấy top trending topics
    const trends = await prisma.contentTrend.findMany({
      where: {
        propertyId,
        detectedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 ngày gần đây
        },
      },
      orderBy: {
        momentumScore: 'desc',
      },
      take: 20,
    });

    if (trends.length === 0) {
      return [];
    }

    const recommendations: Array<{
      suggestedTitle: string;
      suggestedTopic: string;
      basedOnKeyword: string;
      confidenceScore: number;
      suggestedOutline?: string[];
      suggestedKeywords?: string[];
      metaDescription?: string;
    }> = [];

    // Nếu có AI provider, dùng LLM để generate
    if (this.provider !== 'none') {
      for (const trend of trends.slice(0, limit)) {
        try {
          const recommendation = this.provider === 'gemini'
            ? await this.generateWithGemini(trend)
            : await this.generateWithOpenAI(trend);

          if (recommendation) {
            recommendations.push({
              ...recommendation,
              basedOnKeyword: trend.topicKeyword,
              confidenceScore: Math.min(trend.momentumScore / 100, 1),
            });
          }
        } catch (error: any) {
          console.error(`Error generating recommendation for ${trend.topicKeyword} using ${this.provider}:`, error.message);
          // Fallback to simple generation
          recommendations.push(this.generateSimpleRecommendation(trend));
        }
      }
    } else {
      // Fallback: Simple generation without LLM
      for (const trend of trends.slice(0, limit)) {
        recommendations.push(this.generateSimpleRecommendation(trend));
      }
    }

    // Lưu vào database
    for (const rec of recommendations) {
      await prisma.aIContentRecommendation.create({
        data: {
          suggestedTitle: rec.suggestedTitle,
          suggestedTopic: rec.suggestedTopic,
          basedOnKeyword: rec.basedOnKeyword,
          targetPropertyId: propertyId,
          confidenceScore: rec.confidenceScore,
          suggestedOutline: rec.suggestedOutline || [],
          suggestedKeywords: rec.suggestedKeywords || [],
          metaDescription: rec.metaDescription || undefined,
        },
      });
    }

    return recommendations;
  }

  /**
   * Generate recommendation với OpenAI
   */
  private async generateWithOpenAI(trend: {
    topicKeyword: string;
    relatedPages: any;
    momentumScore: number;
  }): Promise<{
    suggestedTitle: string;
    suggestedTopic: string;
    suggestedOutline: string[];
    suggestedKeywords: string[];
    metaDescription: string;
  } | null> {
    if (!this.openai) return null;

    const relatedPages = Array.isArray(trend.relatedPages)
      ? trend.relatedPages.slice(0, 5).join(', ')
      : '';

    const prompt = `Bạn là một content strategist chuyên nghiệp. Dựa trên trending topic sau đây, hãy đề xuất một bài viết:

Topic đang trending: "${trend.topicKeyword}"
Các bài viết liên quan: ${relatedPages}
Momentum score: ${trend.momentumScore}/100

Hãy trả lời theo format JSON:
{
  "title": "Tiêu đề bài viết hấp dẫn",
  "topic": "Chủ đề chính",
  "outline": ["H2 heading 1", "H2 heading 2", "H2 heading 3"],
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "metaDescription": "Mô tả ngắn gọn cho SEO"
}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a professional content strategist. Always respond in valid JSON format.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const content = completion.choices[0]?.message?.content;
      return this.parseAIResponse(content);
    } catch (error: any) {
      console.error('OpenAI API error:', error.message);
      return null;
    }
  }

  /**
   * Generate recommendation với Gemini
   */
  private async generateWithGemini(trend: {
    topicKeyword: string;
    relatedPages: any;
    momentumScore: number;
  }): Promise<{
    suggestedTitle: string;
    suggestedTopic: string;
    suggestedOutline: string[];
    suggestedKeywords: string[];
    metaDescription: string;
  } | null> {
    if (!this.gemini) return null;

    const relatedPages = Array.isArray(trend.relatedPages)
      ? trend.relatedPages.slice(0, 5).join(', ')
      : '';

    const prompt = `Bạn là một content strategist chuyên nghiệp. Dựa trên trending topic sau đây, hãy đề xuất một bài viết:

Topic đang trending: "${trend.topicKeyword}"
Các bài viết liên quan: ${relatedPages}
Momentum score: ${trend.momentumScore}/100

Hãy trả lời theo format JSON (chỉ trả về JSON, không thêm text khác):
{
  "title": "Tiêu đề bài viết hấp dẫn",
  "topic": "Chủ đề chính",
  "outline": ["H2 heading 1", "H2 heading 2", "H2 heading 3"],
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "metaDescription": "Mô tả ngắn gọn cho SEO"
}`;

    try {
      const result = await this.gemini.generateContent(prompt);
      const response = await result.response;
      const content = response.text();
      return this.parseAIResponse(content);
    } catch (error: any) {
      console.error('Gemini API error:', error.message);
      return null;
    }
  }

  /**
   * Parse AI response to JSON
   */
  private parseAIResponse(content: string | null | undefined): any {
    if (!content) return null;

    try {
      // Clean content (sometimes LLMs wrap JSON in code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        suggestedTitle: parsed.title || '',
        suggestedTopic: parsed.topic || '',
        suggestedOutline: parsed.outline || [],
        suggestedKeywords: parsed.keywords || [],
        metaDescription: parsed.metaDescription || '',
      };
    } catch (e) {
      console.error('Error parsing AI response:', e);
      return null;
    }
  }

  /**
   * Generate simple recommendation không cần LLM
   */
  private generateSimpleRecommendation(trend: {
    topicKeyword: string;
    momentumScore: number;
  }): {
    suggestedTitle: string;
    suggestedTopic: string;
    basedOnKeyword: string;
    confidenceScore: number;
  } {
    const keyword = trend.topicKeyword;
    const titleTemplates = [
      `Tất cả về ${keyword}: Hướng dẫn chi tiết 2024`,
      `${keyword}: Xu hướng và cơ hội mới nhất`,
      `Phân tích sâu về ${keyword} bạn cần biết`,
      `${keyword}: Những điều quan trọng không thể bỏ qua`,
    ];

    const randomTemplate =
      titleTemplates[Math.floor(Math.random() * titleTemplates.length)];

    return {
      suggestedTitle: randomTemplate,
      suggestedTopic: keyword,
      basedOnKeyword: keyword,
      confidenceScore: Math.min(trend.momentumScore / 100, 1),
    };
  }

  /**
   * Analyze reader behavior patterns
   */
  async analyzeReaderBehavior(
    propertyId: string,
    days: number = 30
  ): Promise<Array<{
    hour: number;
    avgSessions: number;
    bestCategory: string | null;
    bounceRate: number;
  }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const snapshots = await prisma.trafficSnapshot.findMany({
      where: {
        propertyId,
        date: {
          gte: startDate,
        },
      },
    });

    // Group by hour (cần thêm hour vào snapshot hoặc tính từ date)
    const hourlyData: Record<
      number,
      {
        sessions: number[];
        categories: Record<string, number>;
      }
    > = {};

    for (const snapshot of snapshots) {
      // Giả sử lấy hour từ date (hoặc cần thêm field hour vào schema)
      const hour = snapshot.date.getHours();

      if (!hourlyData[hour]) {
        hourlyData[hour] = {
          sessions: [],
          categories: {},
        };
      }

      hourlyData[hour].sessions.push(snapshot.sessions);

      // Extract category từ pagePath
      const category = this.extractCategory(snapshot.pagePath);
      hourlyData[hour].categories[category] =
        (hourlyData[hour].categories[category] || 0) + snapshot.pageViews;
    }

    const patterns: Array<{
      hour: number;
      avgSessions: number;
      bestCategory: string | null;
      bounceRate: number;
    }> = [];

    for (const [hourStr, data] of Object.entries(hourlyData)) {
      const hour = parseInt(hourStr, 10);
      const avgSessions =
        data.sessions.reduce((a, b) => a + b, 0) / data.sessions.length;

      const bestCategory = Object.entries(data.categories)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

      patterns.push({
        hour,
        avgSessions: Math.round(avgSessions * 100) / 100,
        bestCategory,
        bounceRate: 0, // Cần thêm bounce rate vào snapshot
      });
    }

    // Lưu vào database
    const periodEnd = new Date();
    const periodStart = new Date(startDate);

    for (const pattern of patterns) {
      await prisma.readerBehaviorPattern.upsert({
        where: {
          propertyId_hour_periodStart: {
            propertyId,
            hour: pattern.hour,
            periodStart,
          },
        },
        update: {
          avgSessions: pattern.avgSessions,
          bestCategory: pattern.bestCategory || undefined,
          periodEnd,
        },
        create: {
          propertyId,
          hour: pattern.hour,
          avgSessions: pattern.avgSessions,
          bestCategory: pattern.bestCategory || undefined,
          periodStart,
          periodEnd,
        },
      });
    }

    return patterns.sort((a, b) => a.hour - b.hour);
  }

  /**
   * Extract category từ pagePath
   */
  private extractCategory(pagePath: string): string {
    const segments = pagePath.split('/').filter(Boolean);
    return segments[0] || 'other';
  }
}
