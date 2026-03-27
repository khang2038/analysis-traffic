import cron from 'node-cron';
import { DataCollectorService } from '../services/dataCollector';
import { TrendDetectionService } from '../services/trendDetection';
import { AIRecommendationService } from '../services/aiRecommendation';
import { parseSitesEnv, fetchLeaderboard, fetchLeaderboardByAlias } from '../ga';
import { loadAliasMapFromEnv } from '../alias';
import prisma from '../db/client';
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
   * Cập nhật cache Leaderboard mỗi 15 phút
   */
  startLeaderboardCache(): void {
    const runUpdate = async () => {
      // eslint-disable-next-line no-console
      console.log('[Cron] Updating leaderboard cache...');
      try {
        const sites = parseSitesEnv(process.env.GA4_SITES);
        const aliasMap = loadAliasMapFromEnv();
        const employeeDimension = process.env.GA4_EMPLOYEE_DIMENSION || 'customUser:employee_id';
        const modes = ['alias', 'employee'];
        const dateRanges = [
          { startDate: 'today', endDate: 'today' },
          { startDate: 'yesterday', endDate: 'yesterday' },
          { startDate: '7daysAgo', endDate: 'today' },
          { startDate: '30daysAgo', endDate: 'today' }
        ];

        for (const mode of modes) {
          for (const range of dateRanges) {
            const allEmployeeMap: Record<string, any> = {};

            for (const site of sites) {
              try {
                const data = mode === 'alias'
                  ? await fetchLeaderboardByAlias({
                      propertyId: site.id,
                      startDate: range.startDate,
                      endDate: range.endDate,
                      orderMetric: 'screenPageViews',
                      aliasToEmployee: aliasMap[site.id]
                    })
                  : await fetchLeaderboard({
                      propertyId: site.id,
                      employeeDimension,
                      startDate: range.startDate,
                      endDate: range.endDate,
                      orderMetric: 'screenPageViews'
                    });

                await prisma.leaderboardCache.deleteMany({
                  where: { propertyId: site.id, mode, startDate: range.startDate, endDate: range.endDate, orderMetric: 'screenPageViews' }
                });

                const CHUNK_SIZE = 1000;
                const rowsCount = data.rows?.length || 0;
                
                if (rowsCount === 0) {
                  await prisma.leaderboardCache.create({
                    data: { propertyId: site.id, mode, startDate: range.startDate, endDate: range.endDate, orderMetric: 'screenPageViews', chunkIndex: 0, data: { rows: [], totalEmployees: 0, metricSorted: 'screenPageViews' } as any }
                  });
                } else {
                  for (let i = 0; i < rowsCount; i += CHUNK_SIZE) {
                    const chunkRows = data.rows.slice(i, i + CHUNK_SIZE);
                    await prisma.leaderboardCache.create({
                      data: {
                        propertyId: site.id, mode, startDate: range.startDate, endDate: range.endDate, orderMetric: 'screenPageViews', chunkIndex: Math.floor(i / CHUNK_SIZE),
                        data: { rows: chunkRows, totalEmployees: data.totalEmployees, metricSorted: data.metricSorted } as any
                      }
                    });
                  }
                }

                for (const row of data.rows || []) {
                  let empId = row.employeeId;
                  if (mode === 'alias' && aliasMap[site.id]?.[empId]) {
                    empId = aliasMap[site.id][empId];
                  }
                  if (!allEmployeeMap[empId]) {
                    allEmployeeMap[empId] = { activeUsers: 0, sessions: 0, screenPageViews: 0, totalEngagementTime: 0, eventCount: 0, conversions: 0, totalRevenue: 0 };
                  }
                  allEmployeeMap[empId].activeUsers += row.activeUsers;
                  allEmployeeMap[empId].sessions += row.sessions;
                  allEmployeeMap[empId].screenPageViews += row.screenPageViews;
                  allEmployeeMap[empId].totalEngagementTime += (row.averageEngagementTime || 0) * row.activeUsers;
                  allEmployeeMap[empId].eventCount += row.eventCount || 0;
                  allEmployeeMap[empId].conversions += row.conversions || 0;
                  allEmployeeMap[empId].totalRevenue += row.totalRevenue || 0;
                }
              } catch (siteErr: any) {
                // eslint-disable-next-line no-console
                console.error(`[Cron] Error fetching leaderboard for site ${site.id}:`, siteErr.message);
              }
            }

            const allRows = Object.entries(allEmployeeMap).map(([employeeId, v]) => ({
              employeeId,
              activeUsers: v.activeUsers,
              sessions: v.sessions,
              screenPageViews: v.screenPageViews,
              viewsPerActiveUser: v.activeUsers > 0 ? v.screenPageViews / v.activeUsers : 0,
              averageEngagementTime: v.activeUsers > 0 ? v.totalEngagementTime / v.activeUsers : 0,
              eventCount: v.eventCount,
              conversions: v.conversions,
              totalRevenue: v.totalRevenue,
              rank: 0
            }))
            .sort((a, b) => b.screenPageViews - a.screenPageViews)
            .map((row, idx) => ({ ...row, rank: idx + 1 }));

            await prisma.leaderboardCache.deleteMany({
              where: { propertyId: 'all', mode, startDate: range.startDate, endDate: range.endDate, orderMetric: 'screenPageViews' }
            });

            const ALL_CHUNK_SIZE = 1000;
            if (allRows.length === 0) {
              await prisma.leaderboardCache.create({
                data: { propertyId: 'all', mode, startDate: range.startDate, endDate: range.endDate, orderMetric: 'screenPageViews', chunkIndex: 0, data: { rows: [], totalEmployees: 0, metricSorted: 'screenPageViews' } as any }
              });
            } else {
              for (let i = 0; i < allRows.length; i += ALL_CHUNK_SIZE) {
                const chunkRows = allRows.slice(i, i + ALL_CHUNK_SIZE);
                await prisma.leaderboardCache.create({
                  data: {
                    propertyId: 'all', mode, startDate: range.startDate, endDate: range.endDate, orderMetric: 'screenPageViews', chunkIndex: Math.floor(i / ALL_CHUNK_SIZE),
                    data: { rows: chunkRows, totalEmployees: allRows.length, metricSorted: 'screenPageViews' } as any
                  }
                });
              }
            }
          }
        }
        // eslint-disable-next-line no-console
        console.log('[Cron] Leaderboard cache update completed');
      } catch (error: any) {
        // eslint-disable-next-line no-console
        console.error('[Cron] Error updating leaderboard cache:', error.message);
      }
    };

    // Chạy luôn lập tức ở lần đầu tiên khởi động
    runUpdate().catch(err => console.error(err));

    cron.schedule('*/30 * * * *', runUpdate);

    // eslint-disable-next-line no-console
    console.log('[Cron] Leaderboard cache update scheduled (every 30 mins)');
  }


  /**
   * Start tất cả cron jobs
   */
  startAll(): void {
    this.startDailyCollector();
    this.startWeeklyTrendAnalysis();
    this.startDailyAIRecommendations();
    this.startHourlySpikeDetection();
    this.startLeaderboardCache();
    // eslint-disable-next-line no-console
    console.log('[Cron] All cron jobs started');
  }
}
