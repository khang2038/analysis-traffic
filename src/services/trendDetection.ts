import prisma from '../db/client';

/**
 * Statistical Trend Detection Engine
 * Phân tích xu hướng dựa trên dữ liệu historical
 */
export class TrendDetectionService {
  /**
   * Tính growth rate giữa 2 khoảng thời gian
   */
  calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  /**
   * Tính momentum score (0-100)
   */
  calculateMomentumScore(
    viewsGrowth: number,
    engagementGrowth: number,
    userGrowth: number
  ): number {
    // Weighted average
    const viewsWeight = 0.4;
    const engagementWeight = 0.3;
    const userWeight = 0.3;

    // Normalize growth rates (assume max 200% growth = 100 points)
    const normalize = (rate: number) => Math.min(Math.max(rate / 2, 0), 100);

    const score =
      normalize(viewsGrowth) * viewsWeight +
      normalize(engagementGrowth) * engagementWeight +
      normalize(userGrowth) * userWeight;

    return Math.round(score * 100) / 100;
  }

  /**
   * Detect trends cho một property trong khoảng thời gian
   */
  async detectTrends(
    propertyId: string,
    weekStart: Date,
    weekEnd: Date
  ): Promise<Array<{
    keyword: string;
    growthRate: number;
    momentumScore: number;
    relatedPages: string[];
  }>> {
    // Lấy dữ liệu tuần hiện tại
    const currentWeekData = await prisma.trafficSnapshot.findMany({
      where: {
        propertyId,
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
    });

    // Lấy dữ liệu tuần trước (7 ngày trước)
    const previousWeekStart = new Date(weekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekEnd = new Date(weekEnd);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 7);

    const previousWeekData = await prisma.trafficSnapshot.findMany({
      where: {
        propertyId,
        date: {
          gte: previousWeekStart,
          lte: previousWeekEnd,
        },
      },
    });

    // Aggregate theo keyword (extract từ pageTitle hoặc pagePath)
    const currentAggregated = this.aggregateByKeyword(currentWeekData);
    const previousAggregated = this.aggregateByKeyword(previousWeekData);

    // Tính trends
    const trends: Array<{
      keyword: string;
      growthRate: number;
      momentumScore: number;
      relatedPages: string[];
    }> = [];

    for (const [keyword, data] of Object.entries(currentAggregated)) {
      const prevData = previousAggregated[keyword] || {
        views: 0,
        engagement: 0,
        users: 0,
      };

      const growthRate = this.calculateGrowthRate(data.views, prevData.views);
      const engagementGrowth = this.calculateGrowthRate(
        data.engagement,
        prevData.engagement
      );
      const userGrowth = this.calculateGrowthRate(data.users, prevData.users);

      const momentumScore = this.calculateMomentumScore(
        growthRate,
        engagementGrowth,
        userGrowth
      );

      // Chỉ lưu trends có growth > 10% hoặc momentum > 20
      if (growthRate > 10 || momentumScore > 20) {
        trends.push({
          keyword,
          growthRate: Math.round(growthRate * 100) / 100,
          momentumScore,
          relatedPages: data.pages,
        });
      }
    }

    // Sort theo momentum score
    trends.sort((a, b) => b.momentumScore - a.momentumScore);

    // Lưu vào database
    for (const trend of trends.slice(0, 50)) {
      // Top 50 trends
      await prisma.contentTrend.create({
        data: {
          topicKeyword: trend.keyword,
          propertyId,
          growthRate: trend.growthRate,
          momentumScore: trend.momentumScore,
          relatedPages: trend.relatedPages,
          weekStart,
          weekEnd,
        },
      });
    }

    return trends;
  }

  /**
   * Aggregate dữ liệu theo keyword
   */
  private aggregateByKeyword(
    snapshots: Array<{
      pageTitle: string | null;
      pagePath: string;
      pageViews: number;
      engagementTime: number;
      activeUsers: number;
    }>
  ): Record<
    string,
    {
      views: number;
      engagement: number;
      users: number;
      pages: string[];
    }
  > {
    const aggregated: Record<
      string,
      {
        views: number;
        engagement: number;
        users: number;
        pages: string[];
      }
    > = {};

    for (const snapshot of snapshots) {
      // Extract keyword từ pageTitle hoặc pagePath
      const keyword = this.extractKeyword(snapshot.pageTitle || snapshot.pagePath);

      if (!aggregated[keyword]) {
        aggregated[keyword] = {
          views: 0,
          engagement: 0,
          users: 0,
          pages: [],
        };
      }

      aggregated[keyword].views += snapshot.pageViews;
      aggregated[keyword].engagement += snapshot.engagementTime;
      aggregated[keyword].users += snapshot.activeUsers;
      if (!aggregated[keyword].pages.includes(snapshot.pagePath)) {
        aggregated[keyword].pages.push(snapshot.pagePath);
      }
    }

    return aggregated;
  }

  /**
   * Extract keyword từ title hoặc path
   * Đơn giản: lấy từ đầu title hoặc segment đầu của path
   */
  private extractKeyword(text: string): string {
    if (!text) return 'unknown';

    // Nếu là title, lấy 3-5 từ đầu
    if (text.length < 50) {
      const words = text.split(/\s+/).slice(0, 5);
      return words.join(' ').toLowerCase();
    }

    // Nếu là path, lấy segment quan trọng
    const segments = text.split('/').filter(Boolean);
    if (segments.length > 0) {
      return segments[0].toLowerCase();
    }

    return text.substring(0, 30).toLowerCase();
  }

  /**
   * Detect spike (tăng đột biến)
   */
  async detectSpikes(
    propertyId: string,
    threshold: number = 200 // % tăng trưởng để coi là spike
  ): Promise<Array<{
    pagePath: string;
    growthRate: number;
    currentViews: number;
    previousViews: number;
  }>> {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dayBefore = new Date(today);
    dayBefore.setDate(dayBefore.getDate() - 2);

    const todayData = await prisma.trafficSnapshot.findMany({
      where: {
        propertyId,
        date: today,
      },
    });

    const yesterdayData = await prisma.trafficSnapshot.findMany({
      where: {
        propertyId,
        date: yesterday,
      },
    });

    const spikes: Array<{
      pagePath: string;
      growthRate: number;
      currentViews: number;
      previousViews: number;
    }> = [];

    const yesterdayMap = new Map(
      yesterdayData.map((s) => [s.pagePath, s.pageViews])
    );

    for (const todaySnapshot of todayData) {
      const yesterdayViews = yesterdayMap.get(todaySnapshot.pagePath) || 0;
      const growthRate = this.calculateGrowthRate(
        todaySnapshot.pageViews,
        yesterdayViews
      );

      if (growthRate >= threshold && todaySnapshot.pageViews > 100) {
        // Chỉ alert nếu có ít nhất 100 views
        spikes.push({
          pagePath: todaySnapshot.pagePath,
          growthRate: Math.round(growthRate * 100) / 100,
          currentViews: todaySnapshot.pageViews,
          previousViews: yesterdayViews,
        });
      }
    }

    return spikes.sort((a, b) => b.growthRate - a.growthRate);
  }
}
