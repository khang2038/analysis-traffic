import {useEffect, useMemo, useState} from 'react'
import { Bar } from 'react-chartjs-2'
import './App.css'

type Site = { id: string; label: string }
type LeaderboardRow = {
  rank: number;
  employeeId: string;
  activeUsers: number;
  sessions: number;
  screenPageViews: number;
  viewsPerActiveUser: number;
  averageEngagementTime: number;
  eventCount: number;
  conversions: number;
  totalRevenue: number;
}
type Report = {
  totals: {
    activeUsers: number;
    sessions: number;
    screenPageViews: number;
    viewsPerActiveUser: number;
    averageEngagementTime: number;
  }
  siteTotals: {
    activeUsers: number;
    screenPageViews: number;
  }
  byPageAndScreen: Array<{
    pagePath: string;
    screenClass: string;
    screenPageViews: number;
    activeUsers: number;
    engagementTime: number;
    viewsPerActiveUser: number;
    averageEngagementTime: number;
  }>
  rank: { position: number; totalEmployees: number; metric: string }
}


const api = (path: string) => fetch(path)

function App() {
  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 5) // 5 ngày trước
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0] // Hôm nay
  })
  const [orderMetric] = useState<'screenPageViews'|'activeUsers'|'sessions'>('screenPageViews')
  const [allSitesLeaderboard, setAllSitesLeaderboard] = useState<LeaderboardRow[]>([])
  const [loadingAllSitesLeaderboard, setLoadingAllSitesLeaderboard] = useState<boolean>(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false)
  const [aliasMap, setAliasMap] = useState<Record<string, Record<string, string>>>({})
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [report, setReport] = useState<Report | null>(null)
  const [loadingReport, setLoadingReport] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    api('/api/sites').then(r => r.json()).then(data => {
      setSites(data.sites || [])
      if ((data.sites || []).length > 0) setSiteId(data.sites[0].id)
    })
    api('/api/aliasMap').then(r => r.json()).then(data => {
      console.log('Loaded alias map:', data.aliasMap)
      setAliasMap(data.aliasMap || {})
    }).catch(err => {
      console.error('Failed to load alias map:', err)
    })
  }, [])

  const canRun = useMemo(() => siteId && startDate && endDate, [siteId, startDate, endDate])
  const canRunAll = useMemo(() => startDate && endDate, [startDate, endDate])

  async function loadAllSitesLeaderboard() {
    if (!canRunAll) return
    setError('')
    setLoadingAllSitesLeaderboard(true)
    setAllSitesLeaderboard([])
    try {
      const url = `/api/leaderboard/all?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&orderMetric=${encodeURIComponent(orderMetric)}&mode=alias`
      console.log('Loading all sites leaderboard:', { startDate, endDate, url })
      const r = await api(url)
      const data = await r.json()
      console.log('All sites API response:', data)
      if (data.error) { setError(data.error); return }
      
      const rows = data.rows || []
      const sorted = rows.sort((a: LeaderboardRow, b: LeaderboardRow) => b[orderMetric] - a[orderMetric])
        .map((row: LeaderboardRow, idx: number) => ({ ...row, rank: idx + 1 }))
      
      console.log('All sites sorted rows:', sorted.length, sorted)
      setAllSitesLeaderboard(sorted)
    } finally {
      setLoadingAllSitesLeaderboard(false)
    }
  }

  async function loadLeaderboard() {
    if (!canRun) return
    setError('')
    setLoadingLeaderboard(true)
    setLeaderboard([])
    try {
      const url = `/api/leaderboard?propertyId=${encodeURIComponent(siteId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&orderMetric=${encodeURIComponent(orderMetric)}&mode=alias`
      console.log('Loading leaderboard:', { siteId, startDate, endDate, url })
      const r = await api(url)
      const data = await r.json()
      console.log('API response:', data)
      if (data.error) { setError(data.error); return }
      console.log('Alias map for site:', siteId, aliasMap[siteId])
      console.log('All rows from API:', data.rows?.length || 0, data.rows)
      
      // Server đã aggregate và filter theo aliasToEmployee rồi
      // Không cần filter lại ở frontend, chỉ cần sort và hiển thị
      const rows = data.rows || []
      
      // Đảm bảo sort đúng theo orderMetric
      const sorted = rows.sort((a: LeaderboardRow, b: LeaderboardRow) => b[orderMetric] - a[orderMetric])
        .map((row: LeaderboardRow, idx: number) => ({ ...row, rank: idx + 1 }))
      
      console.log('Sorted rows:', sorted.length, sorted)
      setLeaderboard(sorted)
    } finally {
      setLoadingLeaderboard(false)
    }
  }

  async function loadReportForEmployee(alias: string) {
    setSelectedEmployee(alias)
    setError('')
    setLoadingReport(true)
    setReport(null)
    try {
      const url = `/api/report?propertyId=${encodeURIComponent(siteId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&mode=alias&alias=${encodeURIComponent(alias)}`
      console.log('Loading report for:', alias, url)
      const r = await api(url)
      const data = await r.json()
      console.log('Report response:', data)
      if (data.error) { setError(data.error); setReport(null); return }
      setReport(data)
    } finally {
      setLoadingReport(false)
    }
  }

  useEffect(() => { if (canRunAll && Object.keys(aliasMap).length > 0) { loadAllSitesLeaderboard() } }, [startDate, endDate, orderMetric, aliasMap])
  useEffect(() => { if (canRun && Object.keys(aliasMap).length > 0) { loadLeaderboard() } }, [siteId, startDate, endDate, orderMetric, aliasMap])

  // Helper function để tìm employee name từ tất cả alias maps
  const getEmployeeName = (employeeId: string): string => {
    for (const siteIdKey in aliasMap) {
      const siteMap = aliasMap[siteIdKey]
      // Check xem employeeId có phải là alias không
      if (siteMap[employeeId]) {
        return siteMap[employeeId]
      }
      // Check xem employeeId có phải là employee name không (ngược lại)
      const foundAlias = Object.keys(siteMap).find(alias => siteMap[alias] === employeeId)
      if (foundAlias) {
        return employeeId // employeeId là employee name
      }
    }
    return employeeId
  }

  return (
    <div className="container">
      <h1>Theo dõi bảng xếp hạng và Traffic (GA4)</h1>
      {error && <div className="error">{error}</div>}
      
      {/* Filter ngày ở trên cùng */}
      <div className="controls" style={{marginBottom: '18px'}}>
        <div className="field">
          <label>Bắt đầu</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Kết thúc</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>
      
      {/* Bảng xếp hạng tổng hợp từ tất cả sites */}
      <div className="panel" style={{marginBottom: '18px'}}>
        <div className="panel-header">Bảng xếp hạng toàn bộ sites</div>
        {loadingAllSitesLeaderboard ? (
          <div className="hint" style={{padding: '48px', textAlign: 'center', color: '#94a3b8'}}>
            <div className="spinner" style={{
              width: '40px',
              height: '40px',
              border: '4px solid rgba(99, 102, 241, 0.2)',
              borderTop: '4px solid #6366f1',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }}></div>
            <div style={{fontSize: '18px', marginBottom: '12px'}}>Đang tải dữ liệu...</div>
            <div style={{fontSize: '14px'}}>Vui lòng đợi trong giây lát</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Nhân viên</th>
                <th>Số lần xem</th>
                <th>Số người dùng đang hoạt động</th>
                <th>Số lượt xem trên mỗi người dùng đang hoạt động</th>
                <th>Thời gian tương tác trung bình trên mỗi người dùng đang hoạt động</th>
              </tr>
            </thead>
            <tbody>
              {allSitesLeaderboard.map((row, idx) => {
                const formatTime = (seconds: number) => {
                  const mins = Math.floor(seconds / 60)
                  const secs = Math.floor(seconds % 60)
                  if (mins > 0) {
                    return `${mins} phút ${secs} giây`
                  }
                  return `${secs} giây`
                }
                const employeeName = getEmployeeName(row.employeeId)
                
                return (
                  <tr key={row.rank}>
                    <td>{idx + 1}</td>
                    <td>{employeeName}</td>
                    <td>{row.screenPageViews.toLocaleString('vi-VN')}</td>
                    <td>{row.activeUsers.toLocaleString('vi-VN')}</td>
                    <td>{row.viewsPerActiveUser.toLocaleString('vi-VN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>{formatTime(row.averageEngagementTime)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Controls cho site cụ thể */}
      <div className="controls">
        <div className="field">
          <label>Site</label>
          <select value={siteId} onChange={e => setSiteId(e.target.value)}>
            {sites.map(s => <option value={s.id} key={s.id}>{s.label} ({s.id})</option>)}
          </select>
        </div>
      </div>
      <div className="grid">
        <div className="panel">
          <div className="panel-header">Leaderboard theo alias nhân viên</div>
          {loadingLeaderboard ? (
            <div className="hint" style={{padding: '48px', textAlign: 'center', color: '#94a3b8'}}>
              <div className="spinner" style={{
                width: '40px',
                height: '40px',
                border: '4px solid rgba(99, 102, 241, 0.2)',
                borderTop: '4px solid #6366f1',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }}></div>
              <div style={{fontSize: '18px', marginBottom: '12px'}}>Đang tải dữ liệu...</div>
              <div style={{fontSize: '14px'}}>Vui lòng đợi trong giây lát</div>
            </div>
          ) : (
            <>
              <div className="panel-body">
                <div className="chart">
                  <Bar
                    data={{
                      labels: leaderboard.map(r => {
                        const aliasMapForSite = aliasMap[siteId] || {}
                        const foundAlias = Object.keys(aliasMapForSite).find(
                          alias => aliasMapForSite[alias] === r.employeeId
                        )
                        return foundAlias ? r.employeeId : (aliasMapForSite[r.employeeId] || r.employeeId)
                      }),
                      datasets: [{
                        label: orderMetric,
                        data: leaderboard.map(r => r[orderMetric]),
                        backgroundColor: 'rgba(99, 102, 241, 0.6)',
                        borderColor: 'rgba(99, 102, 241, 1)',
                        borderWidth: 1,
                      }]
                    }}
                    options={{
                      responsive: true,
                      plugins: { legend: { display: false } },
                      scales: { x: { grid: { color: 'rgba(148,163,184,0.1)' } }, y: { grid: { color: 'rgba(148,163,184,0.1)' } } }
                    }}
                  />
                </div>
              </div>
              <table className="table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Nhân viên</th>
                <th>Alias</th>
                <th>Số lần xem</th>
                <th>Số người dùng đang hoạt động</th>
                <th>Số lượt xem trên mỗi người dùng đang hoạt động</th>
                <th>Thời gian tương tác trung bình trên mỗi người dùng đang hoạt động</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row, idx) => {
                const formatTime = (seconds: number) => {
                  const mins = Math.floor(seconds / 60)
                  const secs = Math.floor(seconds % 60)
                  if (mins > 0) {
                    return `${mins} phút ${secs} giây`
                  }
                  return `${secs} giây`
                }
                // employeeId có thể là employee name hoặc alias
                // Nếu là employee name, tìm alias tương ứng
                const aliasMapForSite = aliasMap[siteId] || {}
                const foundAlias = Object.keys(aliasMapForSite).find(
                  alias => aliasMapForSite[alias] === row.employeeId
                )
                const alias = foundAlias || row.employeeId
                const employeeName = foundAlias ? row.employeeId : (aliasMapForSite[row.employeeId] || row.employeeId)
                
                return (
                  <tr key={row.rank} onClick={() => loadReportForEmployee(alias)} className="clickable">
                    <td>{idx + 1}</td>
                    <td>{employeeName}</td>
                    <td>{alias}</td>
                    <td>{row.screenPageViews.toLocaleString('vi-VN')}</td>
                    <td>{row.activeUsers.toLocaleString('vi-VN')}</td>
                    <td>{row.viewsPerActiveUser.toLocaleString('vi-VN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>{formatTime(row.averageEngagementTime)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
            </>
          )}
        </div>
        <div className="panel">
          <div className="panel-header">Chi tiết: {selectedEmployee ? (aliasMap[siteId]?.[selectedEmployee] || selectedEmployee) : '-'}</div>
          {loadingReport ? (
            <div className="hint" style={{padding: '48px', textAlign: 'center', color: '#94a3b8'}}>
              <div className="spinner" style={{
                width: '40px',
                height: '40px',
                border: '4px solid rgba(99, 102, 241, 0.2)',
                borderTop: '4px solid #6366f1',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }}></div>
              <div style={{fontSize: '18px', marginBottom: '12px'}}>Đang tải dữ liệu...</div>
              <div style={{fontSize: '14px'}}>Vui lòng đợi trong giây lát</div>
            </div>
          ) : report ? (
            <>
              <div className="totals">
                Users: {report.totals.activeUsers.toLocaleString('vi-VN')} • Sessions: {report.totals.sessions.toLocaleString('vi-VN')} • Screen PV: {report.totals.screenPageViews.toLocaleString('vi-VN')}
              </div>
              <div className="rank">Rank #{report.rank.position} / {report.rank.totalEmployees} by {report.rank.metric}</div>
              <table className="table small">
                <thead>
                  <tr>
                    <th>Chỉ mục</th>
                    <th>Đường dẫn trang</th>
                    <th>Số lần xem</th>
                    <th>Số người dùng đang hoạt động</th>
                    <th>Số lượt xem trên mỗi người dùng đang hoạt động</th>
                    <th>Thời gian tương tác trung bình trên mỗi người dùng đang hoạt động</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const formatTime = (seconds: number) => {
                      const mins = Math.floor(seconds / 60)
                      const secs = Math.floor(seconds % 60)
                      if (mins > 0) {
                        return `${mins} phút ${secs} giây`
                      }
                      return `${secs} giây`
                    }
                    const siteTotalScreenPV = report.siteTotals?.screenPageViews || report.totals.screenPageViews
                    const siteTotalActiveUsers = report.siteTotals?.activeUsers || report.totals.activeUsers
                    const avgViewsPerUser = report.totals.viewsPerActiveUser
                    const avgEngagementTime = report.totals.averageEngagementTime
                    return (
                      <>
                        {report.byPageAndScreen.map((r, i) => {
                          const pctScreenPV = siteTotalScreenPV > 0 ? (r.screenPageViews / siteTotalScreenPV * 100).toFixed(2) : '0.00'
                          const pctActiveUsers = siteTotalActiveUsers > 0 ? (r.activeUsers / siteTotalActiveUsers * 100).toFixed(2) : '0.00'
                          return (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td className="truncate" title={r.pagePath}>
                                <a href={r.pagePath} target="_blank" rel="noopener noreferrer" style={{color: '#60a5fa', textDecoration: 'underline'}}>
                                  {r.pagePath.length > 80 ? r.pagePath.substring(0, 80) + '...' : r.pagePath}
                                </a>
                              </td>
                              <td>
                                {r.screenPageViews.toLocaleString('vi-VN')} ({pctScreenPV}%)
                              </td>
                              <td>
                                {r.activeUsers.toLocaleString('vi-VN')} ({pctActiveUsers}%)
                              </td>
                              <td>{r.viewsPerActiveUser.toLocaleString('vi-VN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                              <td>{formatTime(r.averageEngagementTime)}</td>
                            </tr>
                          )
                        })}
                        <tr className="total-row">
                          <td></td>
                          <td>Tổng cộng</td>
                          <td>
                            {report.totals.screenPageViews.toLocaleString('vi-VN')}
                            {siteTotalScreenPV > 0 && (
                              <> ({((report.totals.screenPageViews / siteTotalScreenPV) * 100).toFixed(2)}% trong tổng số)</>
                            )}
                          </td>
                          <td>
                            {report.totals.activeUsers.toLocaleString('vi-VN')}
                            {siteTotalActiveUsers > 0 && (
                              <> ({((report.totals.activeUsers / siteTotalActiveUsers) * 100).toFixed(2)}% trong tổng số)</>
                            )}
                          </td>
                          <td>
                            {avgViewsPerUser.toLocaleString('vi-VN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            <span style={{fontSize: '12px', color: '#94a3b8', marginLeft: '4px'}}>Trung bình</span>
                          </td>
                          <td>{formatTime(avgEngagementTime)}</td>
                        </tr>
                      </>
                    )
                  })()}
                </tbody>
              </table>
            </>
          ) : (
            <div className="hint" style={{padding: '24px', textAlign: 'center', color: '#94a3b8'}}>
              Chọn một nhân viên từ leaderboard để xem chi tiết links và biểu đồ.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
