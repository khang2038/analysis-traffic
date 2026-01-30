import {BetaAnalyticsDataClient} from '@google-analytics/data';
import {extractAliasFromPath} from './alias';

export type SiteProperty = {
  id: string; // GA4 property ID
  label: string; // Friendly name for the site
};

export type EmployeeReportParams = {
  propertyId: string;
  employeeDimension: string; // e.g. "customUser:employee_id" or "customEvent:employee_id"
  employeeId: string;
  startDate: string; // e.g. "2024-10-01"
  endDate: string;   // e.g. "today" or "2024-10-31"
};

export type EmployeeReport = {
  totals: {
    activeUsers: number;
    sessions: number;
    screenPageViews: number;
    viewsPerActiveUser: number;
    averageEngagementTime: number;
  };
  siteTotals: {
    activeUsers: number;
    screenPageViews: number;
  };
  byPageAndScreen: Array<{
    pagePath: string;
    screenClass: string;
    screenPageViews: number;
    activeUsers: number;
    engagementTime: number;
    viewsPerActiveUser: number;
    averageEngagementTime: number;
  }>;
  rank: {
    position: number; // 1-based
    totalEmployees: number;
    metric: 'activeUsers' | 'sessions' | 'screenPageViews';
  };
};

export type LeaderboardRow = {
  employeeId: string;
  activeUsers: number;
  sessions: number;
  screenPageViews: number;
  viewsPerActiveUser: number; // screenPageViews / activeUsers
  averageEngagementTime: number; // seconds
  eventCount: number;
  conversions: number; // key events
  totalRevenue: number;
  rank: number; // 1-based
};

export type Leaderboard = {
  rows: LeaderboardRow[];
  totalEmployees: number;
  metricSorted: 'activeUsers' | 'sessions' | 'screenPageViews';
};

export function parseSitesEnv(envValue: string | undefined): SiteProperty[] {
  if (!envValue) return [];
  // Format: label1:PROPERTY_ID_1,label2:PROPERTY_ID_2
  return envValue
    .split(',')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((pair) => {
      // support "label:123", "label(123)", or "label: properties/123"
      let label = pair;
      let id = '';
      if (pair.includes(':')) {
        const parts = pair.split(':');
        label = parts[0].trim();
        id = parts.slice(1).join(':').trim();
      } else if (pair.includes('(') && pair.includes(')')) {
        const m = pair.match(/^(.*?)\((\d+)\)$/);
        if (m) {
          label = m[1].trim();
          id = m[2].trim();
        }
      }
      if (!label) {
        throw new Error('GA4_SITES must be formatted as "label:propertyId,label2:propertyId2"');
      }
      id = normalizePropertyId(id || label);
      return {label, id};
    });
}

function newClient(): BetaAnalyticsDataClient {
  // Uses GOOGLE_APPLICATION_CREDENTIALS or explicit JSON key via env
  // If GA_SERVICE_ACCOUNT_JSON is set, parse it as JSON string directly
  const jsonEnv = process.env.GA_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) {
    try {
      const credentials = JSON.parse(jsonEnv);
      return new BetaAnalyticsDataClient({credentials});
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse GA_SERVICE_ACCOUNT_JSON as JSON:', err.message);
      throw new Error('GA_SERVICE_ACCOUNT_JSON must be a valid JSON string');
    }
  }
  return new BetaAnalyticsDataClient();
}

function toNumber(value: string | null | undefined): number {
  if (!value) return 0;
  // Handle duration strings like "123.45s" or "123.45"
  const cleaned = value.toString().replace(/[^\d.]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function normalizePropertyId(id: string): string {
  // Extract numeric GA4 property id
  // Remove any "properties/" prefix and extract digits
  let cleaned = (id || '').replace(/^properties\//, '').trim();
  const m = cleaned.match(/\d+/);
  return m ? m[0] : cleaned;
}

export async function fetchEmployeeReport(params: EmployeeReportParams, clientOverride?: BetaAnalyticsDataClient): Promise<EmployeeReport> {
  const client = clientOverride ?? newClient();

  const {propertyId, employeeDimension, employeeId, startDate, endDate} = params;

  // 1) Totals + table by page path + screen class for this employee
  // Pagination: fetch all rows
  const MAX_LIMIT = 100000;
  let offset = 0;
  let totalRowCount = 0;
  let allRows: any[] = [];
  let fetchedCount = 0;

  do {
    const [detailResponse] = await client.runReport({
      property: `properties/${normalizePropertyId(propertyId)}`,
      dateRanges: [{startDate, endDate}],
      dimensions: [
        {name: 'pagePathPlusQueryString'},
        {name: 'unifiedScreenClass'}
      ],
      metrics: [
        {name: 'activeUsers'},
        {name: 'sessions'},
        {name: 'screenPageViews'},
        {name: 'userEngagementDuration'}
      ],
      dimensionFilter: {
        filter: {
          fieldName: employeeDimension,
          stringFilter: {matchType: 'EXACT', value: employeeId}
        }
      },
      limit: MAX_LIMIT,
      offset: offset
    });

    const rows = detailResponse.rows ?? [];
    fetchedCount = rows.length;
    allRows = allRows.concat(rows);
    totalRowCount = detailResponse.rowCount ? Number(detailResponse.rowCount) : Math.max(totalRowCount, allRows.length);
    
    offset += MAX_LIMIT;
    // Continue if we got a full batch (means there might be more rows)
  } while (fetchedCount === MAX_LIMIT);

  const rows = allRows;
  // Aggregate by pagePath (không có screenClass)
  const pageMap: Record<string, {
    activeUsers: number;
    sessions: number;
    screenPageViews: number;
    engagementTime: number;
  }> = {};
  
  for (const r of rows) {
    const d = r.dimensionValues ?? [];
    const m = r.metricValues ?? [];
    const pagePath = d[0]?.value ?? '';
    const activeUsers = toNumber(m[0]?.value);
    const sessions = toNumber(m[1]?.value);
    const screenPageViews = toNumber(m[2]?.value);
    const engagementTime = toNumber(m[3]?.value);
    
    if (!pageMap[pagePath]) {
      pageMap[pagePath] = {
        activeUsers: 0,
        sessions: 0,
        screenPageViews: 0,
        engagementTime: 0
      };
    }
    pageMap[pagePath].activeUsers += activeUsers;
    pageMap[pagePath].sessions += sessions;
    pageMap[pagePath].screenPageViews += screenPageViews;
    pageMap[pagePath].engagementTime += engagementTime;
  }
  
  let totalActiveUsers = 0;
  let totalSessions = 0;
  let totalScreenPageViews = 0;
  let totalEngagementTime = 0;
  
  const byPageAndScreen = Object.entries(pageMap)
    .map(([pagePath, data]) => {
      totalActiveUsers += data.activeUsers;
      totalSessions += data.sessions;
      totalScreenPageViews += data.screenPageViews;
      totalEngagementTime += data.engagementTime;
      return {
        pagePath,
        screenClass: '', // Không dùng nữa
        screenPageViews: data.screenPageViews,
        activeUsers: data.activeUsers,
        engagementTime: data.engagementTime,
        viewsPerActiveUser: data.activeUsers > 0 ? data.screenPageViews / data.activeUsers : 0,
        averageEngagementTime: data.activeUsers > 0 ? data.engagementTime / data.activeUsers : 0
      };
    })
    .sort((a, b) => b.screenPageViews - a.screenPageViews);

  // 2) Rank among all employees by screenPageViews (change metric as needed)
  const metricForRank: 'activeUsers' | 'sessions' | 'screenPageViews' = 'screenPageViews';
  // Pagination: fetch all rows for ranking
  offset = 0;
  totalRowCount = 0;
  let allRankRows: any[] = [];
  fetchedCount = 0;

  do {
    const [rankResponse] = await client.runReport({
      property: `properties/${normalizePropertyId(propertyId)}`,
      dateRanges: [{startDate, endDate}],
      dimensions: [{name: employeeDimension}],
      metrics: [{name: metricForRank}],
      orderBys: [{desc: true, metric: {metricName: metricForRank}}],
      limit: MAX_LIMIT,
      offset: offset
    });

    const rankRows = rankResponse.rows ?? [];
    fetchedCount = rankRows.length;
    allRankRows = allRankRows.concat(rankRows);
    totalRowCount = rankResponse.rowCount ? Number(rankResponse.rowCount) : Math.max(totalRowCount, allRankRows.length);
    
    offset += MAX_LIMIT;
    // Continue if we got a full batch (means there might be more rows)
  } while (fetchedCount === MAX_LIMIT);

  // Get site totals (toàn bộ site, không filter)
  const [siteTotalsResponse] = await client.runReport({
    property: `properties/${normalizePropertyId(propertyId)}`,
    dateRanges: [{startDate, endDate}],
    dimensions: [],
    metrics: [
      {name: 'activeUsers'},
      {name: 'screenPageViews'}
    ],
    limit: 1
  });

  const siteTotalsRow = siteTotalsResponse.rows?.[0];
  const siteTotalActiveUsers = toNumber(siteTotalsRow?.metricValues?.[0]?.value);
  const siteTotalScreenPageViews = toNumber(siteTotalsRow?.metricValues?.[1]?.value);

  const rankRows = allRankRows;
  let position = -1;
  for (let i = 0; i < rankRows.length; i++) {
    const dimVal = rankRows[i]?.dimensionValues?.[0]?.value ?? '';
    if (dimVal === employeeId) {
      position = i + 1; // 1-based
      break;
    }
  }

  return {
    totals: {
      activeUsers: totalActiveUsers,
      sessions: totalSessions,
      screenPageViews: totalScreenPageViews,
      viewsPerActiveUser: totalActiveUsers > 0 ? totalScreenPageViews / totalActiveUsers : 0,
      averageEngagementTime: totalActiveUsers > 0 ? totalEngagementTime / totalActiveUsers : 0
    },
    siteTotals: {
      activeUsers: siteTotalActiveUsers,
      screenPageViews: siteTotalScreenPageViews
    },
    byPageAndScreen,
    rank: {
      position,
      totalEmployees: rankRows.length,
      metric: metricForRank
    }
  };
}

export async function fetchLeaderboard(params: {
  propertyId: string;
  employeeDimension: string;
  startDate: string;
  endDate: string;
  orderMetric?: 'activeUsers' | 'sessions' | 'screenPageViews';
  limit?: number;
}, clientOverride?: BetaAnalyticsDataClient): Promise<Leaderboard> {
  const client = clientOverride ?? newClient();
  const {propertyId, employeeDimension, startDate, endDate} = params;
  const orderMetric = params.orderMetric ?? 'screenPageViews';

  // Pagination: fetch all rows
  const MAX_LIMIT = 100000;
  let offset = 0;
  let totalRowCount = 0;
  let allRows: any[] = [];
  let fetchedCount = 0;

  do {
    const [resp] = await client.runReport({
      property: `properties/${normalizePropertyId(propertyId)}`,
      dateRanges: [{startDate, endDate}],
      dimensions: [{name: employeeDimension}],
      metrics: [
        {name: 'activeUsers'},
        {name: 'sessions'},
        {name: 'screenPageViews'},
        {name: 'userEngagementDuration'},
        {name: 'eventCount'},
        {name: 'conversions'},
        {name: 'totalRevenue'}
      ],
      orderBys: [{desc: true, metric: {metricName: orderMetric}}],
      limit: MAX_LIMIT,
      offset: offset
    });

    const rows = resp.rows ?? [];
    fetchedCount = rows.length;
    allRows = allRows.concat(rows);
    totalRowCount = resp.rowCount ? Number(resp.rowCount) : Math.max(totalRowCount, allRows.length);
    
    offset += MAX_LIMIT;
    // Continue if we got a full batch (means there might be more rows)
  } while (fetchedCount === MAX_LIMIT);

  const rows = allRows;
  const leaderboardRows: LeaderboardRow[] = rows.map((r, idx) => {
    const d = r.dimensionValues ?? [];
    const m = r.metricValues ?? [];
    const activeUsers = toNumber(m[0]?.value);
    const sessions = toNumber(m[1]?.value);
    const screenPageViews = toNumber(m[2]?.value);
    const engagementTime = toNumber(m[3]?.value); // total engagement time in seconds
    const eventCount = toNumber(m[4]?.value);
    const conversions = toNumber(m[5]?.value);
    const totalRevenue = toNumber(m[6]?.value);
    
    return {
      employeeId: d[0]?.value ?? '',
      activeUsers,
      sessions,
      screenPageViews,
      viewsPerActiveUser: activeUsers > 0 ? screenPageViews / activeUsers : 0,
      averageEngagementTime: activeUsers > 0 ? engagementTime / activeUsers : 0, // Average engagement time per active user
      eventCount,
      conversions,
      totalRevenue,
      rank: idx + 1
    };
  });

  return {
    rows: leaderboardRows,
    totalEmployees: totalRowCount > 0 ? totalRowCount : rows.length,
    metricSorted: orderMetric
  };
}

// Extract alias từ pageTitle + screenClass (cho property 495153878)
function extractAliasFromTitle(pageTitle: string, screenClass: string, allowedAliases: Set<string>): string {
  const combined = `${pageTitle} ${screenClass}`.toLowerCase();
  // Tìm alias nào xuất hiện trong combined string
  for (const alias of allowedAliases) {
    if (combined.includes(alias.toLowerCase())) {
      return alias;
    }
  }
  return '';
}

export async function fetchLeaderboardByAlias(params: {
  propertyId: string;
  startDate: string;
  endDate: string;
  orderMetric?: 'activeUsers' | 'sessions' | 'screenPageViews';
  limit?: number; // limit of GA rows (pages) to fetch, aggregation is server-side
  aliasToEmployee?: Record<string, string>; // alias -> employeeId
}, clientOverride?: BetaAnalyticsDataClient): Promise<Leaderboard> {
  const client = clientOverride ?? newClient();
  const {propertyId, startDate, endDate} = params;
  const orderMetric = params.orderMetric ?? 'screenPageViews';
  const normalizedPropertyId = normalizePropertyId(propertyId);
  
  // Property 495153878 dùng pageTitle + screenClass, các property khác dùng pagePath
  const useTitleAndScreen = normalizedPropertyId === '495153878';
  const allowedAliases = params.aliasToEmployee ? new Set(Object.keys(params.aliasToEmployee)) : new Set<string>();

  const map: Record<string, {
    activeUsers: number;
    sessions: number;
    screenPageViews: number;
    totalEngagementTime: number;
    eventCount: number;
    conversions: number;
    totalRevenue: number;
  }> = {};
  // Chỉ aggregate các alias có trong aliasToEmployee (nếu có)
  const shouldFilterAliases = params.aliasToEmployee && Object.keys(params.aliasToEmployee).length > 0;

  // Pagination: fetch all rows
  const MAX_LIMIT = 100000;
  let offset = 0;
  let totalRowCount = 0;
  let allRows: any[] = [];
  let fetchedCount = 0;

  do {
    const [resp] = await client.runReport({
      property: `properties/${normalizedPropertyId}`,
      dateRanges: [{startDate, endDate}],
      dimensions: useTitleAndScreen 
        ? [{name: 'pageTitle'}, {name: 'unifiedScreenClass'}]
        : [{name: 'pagePathPlusQueryString'}],
      metrics: [
        {name: 'activeUsers'},
        {name: 'sessions'},
        {name: 'screenPageViews'},
        {name: 'userEngagementDuration'},
        {name: 'eventCount'},
        {name: 'conversions'},
        {name: 'totalRevenue'}
      ],
      orderBys: [{desc: true, metric: {metricName: 'screenPageViews'}}],
      limit: MAX_LIMIT,
      offset: offset
    });

    const rows = resp.rows ?? [];
    fetchedCount = rows.length;
    allRows = allRows.concat(rows);
    totalRowCount = resp.rowCount ? Number(resp.rowCount) : Math.max(totalRowCount, allRows.length);
    
    offset += MAX_LIMIT;
    // Continue if we got a full batch (means there might be more rows)
  } while (fetchedCount === MAX_LIMIT);
  
  for (const r of allRows) {
    const d = r.dimensionValues ?? [];
    const m = r.metricValues ?? [];
    
    let alias = '';
    let pageKey = '';
    if (useTitleAndScreen) {
      // Property 495153878: extract từ pageTitle + screenClass
      const pageTitle = d[0]?.value ?? '';
      const screenClass = d[1]?.value ?? '';
      pageKey = pageTitle;
      alias = extractAliasFromTitle(pageTitle, screenClass, allowedAliases);
      if (!alias) {
        continue;
      }
    } else {
      // Các property khác: extract từ pagePath
      const pagePath = d[0]?.value ?? '';
      pageKey = pagePath;
      alias = extractAliasFromPath(pagePath);
      if (!alias) {
        continue;
      }
      
      // Nếu có aliasToEmployee, chỉ aggregate các alias có trong map
      if (shouldFilterAliases && !allowedAliases.has(alias)) {
        continue;
      }
    }
    
    const employeeId = params.aliasToEmployee?.[alias] ?? alias;
    const screenPV = toNumber(m[2]?.value);
    const activeUsers = toNumber(m[0]?.value);
    
    if (!map[employeeId]) {
      map[employeeId] = {
        activeUsers: 0,
        sessions: 0,
        screenPageViews: 0,
        totalEngagementTime: 0,
        eventCount: 0,
        conversions: 0,
        totalRevenue: 0
      };
    }
    map[employeeId].activeUsers += activeUsers;
    map[employeeId].sessions += toNumber(m[1]?.value);
    map[employeeId].screenPageViews += screenPV;
    map[employeeId].totalEngagementTime += toNumber(m[3]?.value);
    map[employeeId].eventCount += toNumber(m[4]?.value);
    map[employeeId].conversions += toNumber(m[5]?.value);
    map[employeeId].totalRevenue += toNumber(m[6]?.value);
  }

  const rows: LeaderboardRow[] = Object.entries(map)
    .map(([employeeId, v]) => {
      return {
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
      };
    })
    .sort((a, b) => b[orderMetric] - a[orderMetric])
    .map((row, idx) => ({...row, rank: idx + 1}));

  return {
    rows,
    totalEmployees: rows.length,
    metricSorted: orderMetric
  };
}

export async function fetchEmployeeReportByAlias(params: {
  propertyId: string;
  alias: string;
  startDate: string;
  endDate: string;
  aliasToEmployee?: Record<string, string>;
}, clientOverride?: BetaAnalyticsDataClient): Promise<EmployeeReport> {
  const client = clientOverride ?? newClient();
  const {propertyId, alias, startDate, endDate} = params;
  const normalizedPropertyId = normalizePropertyId(propertyId);
  const useTitleAndScreen = normalizedPropertyId === '495153878';

  // Pagination: fetch all rows
  const MAX_LIMIT = 100000;
  let offset = 0;
  let totalRowCount = 0;
  let allRows: any[] = [];
  let fetchedCount = 0;

  do {
    const [detailResponse] = await client.runReport({
      property: `properties/${normalizedPropertyId}`,
      dateRanges: [{startDate, endDate}],
      dimensions: useTitleAndScreen
        ? [{name: 'pageTitle'}, {name: 'unifiedScreenClass'}]
        : [{name: 'pagePathPlusQueryString'}, {name: 'unifiedScreenClass'}],
      metrics: [
        {name: 'activeUsers'},
        {name: 'sessions'},
        {name: 'screenPageViews'},
        {name: 'userEngagementDuration'}
      ],
      dimensionFilter: useTitleAndScreen
        ? {
            filter: {
              fieldName: 'pageTitle',
              stringFilter: {matchType: 'CONTAINS', value: alias}
            }
          }
        : {
            filter: {
              fieldName: 'pagePathPlusQueryString',
              stringFilter: {matchType: 'CONTAINS', value: alias}
            }
          },
      limit: MAX_LIMIT,
      offset: offset
    });

    const rows = detailResponse.rows ?? [];
    fetchedCount = rows.length;
    allRows = allRows.concat(rows);
    totalRowCount = detailResponse.rowCount ? Number(detailResponse.rowCount) : Math.max(totalRowCount, allRows.length);
    
    // eslint-disable-next-line no-console
    console.log(`fetchEmployeeReportByAlias: propertyId=${normalizedPropertyId}, alias=${alias}, offset=${offset}, fetched=${fetchedCount}, totalRowCount=${totalRowCount}, accumulated=${allRows.length}`);
    
    offset += MAX_LIMIT;
    // Continue if we got a full batch (means there might be more rows)
  } while (fetchedCount === MAX_LIMIT);

  const rows = allRows;
  // Aggregate by pagePath hoặc pageTitle tùy theo property
  const pageMap: Record<string, {
    activeUsers: number;
    sessions: number;
    screenPageViews: number;
    engagementTime: number;
  }> = {};
  
  for (const r of rows) {
    const d = r.dimensionValues ?? [];
    const m = r.metricValues ?? [];
    // Property 495153878 dùng pageTitle, các property khác dùng pagePath
    const pageKey = d[0]?.value ?? ''; // pageTitle hoặc pagePath
    const activeUsers = toNumber(m[0]?.value);
    const sessions = toNumber(m[1]?.value);
    const screenPageViews = toNumber(m[2]?.value);
    const engagementTime = toNumber(m[3]?.value);
    
    if (!pageMap[pageKey]) {
      pageMap[pageKey] = {
        activeUsers: 0,
        sessions: 0,
        screenPageViews: 0,
        engagementTime: 0
      };
    }
    pageMap[pageKey].activeUsers += activeUsers;
    pageMap[pageKey].sessions += sessions;
    pageMap[pageKey].screenPageViews += screenPageViews;
    pageMap[pageKey].engagementTime += engagementTime;
  }
  
  let totalActiveUsers = 0;
  let totalSessions = 0;
  let totalScreenPageViews = 0;
  let totalEngagementTime = 0;
  
  const byPageAndScreen = Object.entries(pageMap)
    .map(([pageKey, data]) => {
      totalActiveUsers += data.activeUsers;
      totalSessions += data.sessions;
      totalScreenPageViews += data.screenPageViews;
      totalEngagementTime += data.engagementTime;
      return {
        pagePath: pageKey, // Có thể là pageTitle hoặc pagePath
        screenClass: '', // Không dùng nữa
        screenPageViews: data.screenPageViews,
        activeUsers: data.activeUsers,
        engagementTime: data.engagementTime,
        viewsPerActiveUser: data.activeUsers > 0 ? data.screenPageViews / data.activeUsers : 0,
        averageEngagementTime: data.activeUsers > 0 ? data.engagementTime / data.activeUsers : 0
      };
    })
    .sort((a, b) => b.screenPageViews - a.screenPageViews);

  // Get site totals (toàn bộ site, không filter)
  const [siteTotalsResponse] = await client.runReport({
    property: `properties/${normalizePropertyId(propertyId)}`,
    dateRanges: [{startDate, endDate}],
    dimensions: [],
    metrics: [
      {name: 'activeUsers'},
      {name: 'screenPageViews'}
    ],
    limit: 1
  });

  const siteTotalsRow = siteTotalsResponse.rows?.[0];
  const siteTotalActiveUsers = toNumber(siteTotalsRow?.metricValues?.[0]?.value);
  const siteTotalScreenPageViews = toNumber(siteTotalsRow?.metricValues?.[1]?.value);

  // Rank by alias via aggregated leaderboard
  const leaderboard = await fetchLeaderboardByAlias({
    propertyId,
    startDate,
    endDate,
    orderMetric: 'screenPageViews',
    aliasToEmployee: params.aliasToEmployee
  });

  const employeeId = params.aliasToEmployee?.[alias] ?? alias;
  const position = leaderboard.rows.find((r) => r.employeeId === employeeId)?.rank ?? -1;

  return {
    totals: {
      activeUsers: totalActiveUsers,
      sessions: totalSessions,
      screenPageViews: totalScreenPageViews,
      viewsPerActiveUser: totalActiveUsers > 0 ? totalScreenPageViews / totalActiveUsers : 0,
      averageEngagementTime: totalActiveUsers > 0 ? totalEngagementTime / totalActiveUsers : 0
    },
    siteTotals: {
      activeUsers: siteTotalActiveUsers,
      screenPageViews: siteTotalScreenPageViews
    },
    byPageAndScreen,
    rank: {
      position,
      totalEmployees: leaderboard.totalEmployees,
      metric: 'screenPageViews'
    }
  };
}


