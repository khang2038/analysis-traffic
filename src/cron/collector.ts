import cron from 'node-cron';
import { DataCollectorService } from '../services/dataCollector';
import { TrendDetectionService } from '../services/trendDetection';
import { AIRecommendationService } from '../services/aiRecommendation';
import { parseSitesEnv } from '../ga';

/**
 * Cron Jobs cho Data Collection và AI Analysis
 */
export class CronJobs {
  private dataCollector: DataCollectorService;
  private trendDetector: TrendDetectionService;
  private aiRecommendation: AIRecommendationService;

  constructor() {
    this.dataCollector = new DataCollectorService();
    this.trendDetector = new TrendDetectionService();
    this.aiRecommendation = new AIRecommendationService();
  }

  /**
   * Chạy collector mỗi ngày lúc 2h sáng
   */
  startDailyCollector(): void {
    // Chạy mỗi ngày lúc 2:00 AM
    cron.schedule('0 2 * * *', async () => {
      // eslint-disable-next-line no-console
      console.log('[Cron] Starting daily data collection...');
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const results = await this.dataCollector.collectAllSnapshots(yesterday);
        // eslint-disable-next-line no-console
        console.log('[Cron] Data collection completed:', results);
      } catch (error: any) {
        // eslint-disable-next-line no-console
        console.error('[Cron] Error in daily collector:', error.message);
      }
    });

    // eslint-disable-next-line no-console
    console.log('[Cron] Daily collector scheduled (2:00 AM daily)');
  }

  /**
   * Chạy trend detection mỗi tuần (Chủ nhật 3h sáng)
   */
  startWeeklyTrendAnalysis(): void {
    cron.schedule('0 3 * * 0', async () => {
      // eslint-disable-next-line no-console
      console.log('[Cron] Starting weekly trend analysis...');
      try {
        const sites = parseSitesEnv(process.env.GA4_SITES);
        const weekEnd = new Date();
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 7);

        for (const site of sites) {
          try {
            const trends = await this.trendDetector.detectTrends(
              site.id,
              weekStart,
              weekEnd
            );
            // eslint-disable-next-line no-console
            console.log(`[Cron] Detected ${trends.length} trends for ${site.label}`);
          } catch (error: any) {
            // eslint-disable-next-line no-console
            console.error(`[Cron] Error detecting trends for ${site.id}:`, error.message);
          }
        }
      } catch (error: any) {
        // eslint-disable-next-line no-console
        console.error('[Cron] Error in weekly trend analysis:', error.message);
      }
    });

    // eslint-disable-next-line no-console
    console.log('[Cron] Weekly trend analysis scheduled (Sunday 3:00 AM)');
  }

  /**
   * Generate AI recommendations mỗi ngày lúc 4h sáng
   */
  startDailyAIRecommendations(): void {
    cron.schedule('0 4 * * *', async () => {
      // eslint-disable-next-line no-console
      console.log('[Cron] Starting daily AI recommendations...');
      try {
        const sites = parseSitesEnv(process.env.GA4_SITES);

        for (const site of sites) {
          try {
            const recommendations = await this.aiRecommendation.generateRecommendations(
              site.id,
              10
            );
            // eslint-disable-next-line no-console
            console.log(
              `[Cron] Generated ${recommendations.length} recommendations for ${site.label}`
            );
          } catch (error: any) {
            // eslint-disable-next-line no-console
            console.error(
              `[Cron] Error generating recommendations for ${site.id}:`,
              error.message
            );
          }
        }
      } catch (error: any) {
        // eslint-disable-next-line no-console
        console.error('[Cron] Error in daily AI recommendations:', error.message);
      }
    });

    // eslint-disable-next-line no-console
    console.log('[Cron] Daily AI recommendations scheduled (4:00 AM daily)');
  }

  /**
   * Check spikes mỗi giờ
   */
  startHourlySpikeDetection(): void {
    cron.schedule('0 * * * *', async () => {
      // eslint-disable-next-line no-console
      console.log('[Cron] Checking for traffic spikes...');
      try {
        const sites = parseSitesEnv(process.env.GA4_SITES);
        const trendDetector = new TrendDetectionService();

        for (const site of sites) {
          try {
            const spikes = await trendDetector.detectSpikes(site.id, 200);
            if (spikes.length > 0) {
              // eslint-disable-next-line no-console
              console.log(`[Cron] Detected ${spikes.length} spikes for ${site.label}`);
              // TODO: Send alerts (Slack, Email, etc.)
            }
          } catch (error: any) {
            // eslint-disable-next-line no-console
            console.error(`[Cron] Error detecting spikes for ${site.id}:`, error.message);
          }
        }
      } catch (error: any) {
        // eslint-disable-next-line no-console
        console.error('[Cron] Error in spike detection:', error.message);
      }
    });

    // eslint-disable-next-line no-console
    console.log('[Cron] Hourly spike detection scheduled');
  }

  /**
   * Start tất cả cron jobs
   */
  startAll(): void {
    this.startDailyCollector();
    this.startWeeklyTrendAnalysis();
    this.startDailyAIRecommendations();
    this.startHourlySpikeDetection();
    // eslint-disable-next-line no-console
    console.log('[Cron] All cron jobs started');
  }
}
