import { BetaAnalyticsDataClient } from '@google-analytics/data';
import prisma from '../db/client';
import { parseSitesEnv, normalizePropertyId } from '../ga';
import { newClient } from '../ga';

/**
 * GA4 Data Collector Service
 * Thu thập dữ liệu từ GA4 và lưu vào database mỗi ngày
 */
export class DataCollectorService {
  /**
   * Collect và lưu snapshot cho một property
   */
  async collectSnapshotForProperty(
    propertyId: string,
    date: Date,
    client?: BetaAnalyticsDataClient
  ): Promise<number> {
    const analyticsClient = client || newClient();
    const normalizedPropertyId = normalizePropertyId(propertyId);
    const dateStr = date.toISOString().split('T')[0];

    // Fetch dữ liệu từ GA4
    const [response] = await analyticsClient.runReport({
      property: `properties/${normalizedPropertyId}`,
      dateRanges: [{ startDate: dateStr, endDate: dateStr }],
      dimensions: [
        { name: 'pagePathPlusQueryString' },
        { name: 'pageTitle' },
        { name: 'customUser:employee_id' }, // Hoặc customEvent:employee_id
      ],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'userEngagementDuration' },
        { name: 'eventCount' },
        { name: 'conversions' },
        { name: 'totalRevenue' },
      ],
      limit: 100000,
    });

    const rows = response.rows || [];
    let savedCount = 0;

    // Lưu từng row vào database
    for (const row of rows) {
      const dims = row.dimensionValues || [];
      const metrics = row.metricValues || [];

      const pagePath = dims[0]?.value || '';
      const pageTitle = dims[1]?.value || '';
      const employeeId = dims[2]?.value || null;

      const activeUsers = parseInt(metrics[0]?.value || '0', 10);
      const sessions = parseInt(metrics[1]?.value || '0', 10);
      const pageViews = parseInt(metrics[2]?.value || '0', 10);
      const engagementTime = parseFloat(metrics[3]?.value || '0');
      const eventCount = parseInt(metrics[4]?.value || '0', 10);
      const conversions = parseInt(metrics[5]?.value || '0', 10);
      const totalRevenue = parseFloat(metrics[6]?.value || '0');

      // Extract alias từ pagePath nếu có
      const alias = this.extractAliasFromPath(pagePath);

      try {
        await prisma.trafficSnapshot.upsert({
          where: {
            propertyId_employeeId_alias_pagePath_date: {
              propertyId: normalizedPropertyId,
              employeeId: employeeId || '',
              alias: alias || '',
              pagePath,
              date,
            },
          },
          update: {
            activeUsers,
            sessions,
            pageViews,
            engagementTime,
            eventCount,
            conversions,
            totalRevenue,
            pageTitle: pageTitle || undefined,
          },
          create: {
            propertyId: normalizedPropertyId,
            employeeId: employeeId || undefined,
            alias: alias || undefined,
            pagePath,
            pageTitle: pageTitle || undefined,
            date,
            activeUsers,
            sessions,
            pageViews,
            engagementTime,
            eventCount,
            conversions,
            totalRevenue,
          },
        });
        savedCount++;
      } catch (error: any) {
        // eslint-disable-next-line no-console
        console.error(`Error saving snapshot for ${pagePath}:`, error.message);
      }
    }

    return savedCount;
  }

  /**
   * Collect snapshots cho tất cả properties
   */
  async collectAllSnapshots(date?: Date): Promise<Record<string, number>> {
    const targetDate = date || new Date();
    const sites = parseSitesEnv(process.env.GA4_SITES);
    const results: Record<string, number> = {};

    for (const site of sites) {
      try {
        const count = await this.collectSnapshotForProperty(site.id, targetDate);
        results[site.id] = count;
        // eslint-disable-next-line no-console
        console.log(`Collected ${count} snapshots for ${site.label} (${site.id})`);
      } catch (error: any) {
        // eslint-disable-next-line no-console
        console.error(`Error collecting snapshots for ${site.id}:`, error.message);
        results[site.id] = 0;
      }
    }

    return results;
  }

  /**
   * Extract alias từ pagePath (tương tự logic trong alias.ts)
   */
  private extractAliasFromPath(pagePathPlusQueryString: string): string | null {
    const pathOnly = pagePathPlusQueryString.split('?')[0].split('#')[0];
    const segments = pathOnly.split('/').filter(Boolean);
    if (segments.length === 0) return null;
    const lastSegment = segments[segments.length - 1];

    if (lastSegment.includes('-')) {
      const parts = lastSegment.split('-');
      return parts[parts.length - 1] || lastSegment;
    }

    return lastSegment;
  }
}
