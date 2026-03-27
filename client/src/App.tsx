import { useEffect, useMemo, useRef, useState, Fragment } from 'react'
import ReactDOM from 'react-dom'
import { Bar } from 'react-chartjs-2'
import { 
  LayoutDashboard, 
  TrendingUp, 
  Sparkles, 
  UserCircle, 
  Clock,
  BarChart3,
  BrainCircuit,
  Settings,
  HelpCircle,
  ChevronRight,
  Sun,
  Moon,
  Globe,
  Trophy,
  Menu,
  X,
  ChevronUp,
  ChevronDown
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AIAnalysisModal from './components/AIAnalysisModal'
import TrendRadarView from './components/TrendRadarView'
import AIContentLab from './components/AIContentLab'
import AICoachView from './components/AICoachView'
import RealtimeView from './components/RealtimeView'
import { DateRangePicker } from './components/DateRangePicker'
import './App.css'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

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

type TabType = 'dashboard' | 'realtime' | 'radar' | 'lab' | 'coach';

const api = (path: string, options?: RequestInit) => fetch(path, options)

// Helper Component: Sidebar Item
const NavItem = ({ icon: Icon, label, active, onClick }: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => (
  <div className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
    <Icon size={20} />
    <span>{label}</span>
  </div>
);

// Site Selector custom dropdown
type SiteSelectorProps = { sites: { id: string; label: string }[]; siteId: string; onChange: (id: string) => void }
const SiteSelector = ({ sites, siteId, onChange }: SiteSelectorProps) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const label = sites.find(s => s.id === siteId)?.label ?? siteId;

  useEffect(() => {
    if (!open) return;
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    const close = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <>
      <button ref={btnRef} className="drp-trigger" onClick={() => setOpen(o => !o)}>
        <Globe size={16} />
        <span>{label}</span>
        <ChevronRight size={14} style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', opacity: 0.5 }} />
      </button>
      {open && ReactDOM.createPortal(
        <div ref={menuRef} className="site-dd-popover" style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 99999 }}>
          {sites.map(s => (
            <button
              key={s.id}
              className={`site-dd-item${s.id === siteId ? ' active' : ''}`}
              onClick={() => { onChange(s.id); setOpen(false); }}
            >
              {s.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};

const EXCLUDED_USERS = ['ngoc', 'ngọc'];
const EXCLUDED_USERS_EXACT = ['thao', 'thảo', 'chuong'];

type TeamLeaderboardProps = {
  leaderboard: LeaderboardRow[];
  getEmployeeName: (id: string) => string;
  groupsMap: Record<string, string[]>;
  t: any;
};

const TeamLeaderboard = ({ leaderboard, getEmployeeName, groupsMap, t }: TeamLeaderboardProps) => {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const teamStats = Object.entries(groupsMap).map(([teamName, members], idx) => {
    const teamId = `t${idx}`;
    const membersData = leaderboard.filter(row => {
      const name = getEmployeeName(row.employeeId).toLowerCase().trim();
      const id = row.employeeId.toLowerCase().trim();
      const lowerMembers = members.map(m => m.toLowerCase().trim());
      return lowerMembers.includes(name) || lowerMembers.includes(id);
    });
    membersData.sort((a, b) => b.screenPageViews - a.screenPageViews);

    const views = membersData.reduce((acc, row) => acc + (row.screenPageViews || 0), 0);
    const users = membersData.reduce((acc, row) => acc + (row.activeUsers || 0), 0);

    return { id: teamId, name: teamName, members, views, users, membersData };
  }).filter(t => t.views > 0).sort((a, b) => b.views - a.views);

  if (teamStats.length === 0) return null;

  return (
    <section className="card glass" style={{ marginTop: '24px' }}>
      <div className="section-header">
        <h2>{t('leaderboard.team_title') || 'Bảng xếp hạng theo nhóm (toàn bộ sites)'}</h2>
      </div>
      <div className="data-table-container">
        <table className="data-table">
          <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-sidebar, #0f172a)' }}>
            <tr>
              <th style={{ width: '80px', textAlign: 'center' }}>{t('leaderboard.rank', 'Rank')}</th>
              <th>{t('leaderboard.team', 'Nhóm')}</th>
              <th>{t('leaderboard.views_count', 'Số lần xem')}</th>
              <th>{t('leaderboard.active_users_count', 'Số người dùng đang hoạt động')}</th>
            </tr>
          </thead>
          <tbody>
            {teamStats.map((team, idx) => (
              <Fragment key={`team-${team.id}`}>
                <tr 
                  onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}
                  style={{ cursor: 'pointer', background: expandedTeam === team.id ? 'rgba(99, 102, 241, 0.05)' : '' }}
                >
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600 }}>{team.name}</span>
                      <span className="text-muted" style={{ fontSize: '12px' }}>
                        ({team.membersData.map(r => getEmployeeName(r.employeeId)).join(', ')})
                      </span>
                      {expandedTeam === team.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </td>
                  <td className="font-bold text-indigo-400">{team.views.toLocaleString()}</td>
                  <td>{team.users.toLocaleString()}</td>
                </tr>
                {expandedTeam === team.id && team.membersData.map(member => (
                  <tr key={`member-${team.id}-${member.employeeId}`} style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                    <td></td>
                    <td style={{ paddingLeft: '40px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', fontWeight: 700, fontSize: '10px' }}>
                          {getEmployeeName(member.employeeId).substring(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500, fontSize: '13px' }}>{getEmployeeName(member.employeeId)}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '13px' }}>{member.screenPageViews.toLocaleString()}</td>
                    <td style={{ fontSize: '13px' }}>{member.activeUsers.toLocaleString()}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

function App() {
  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 3) // 3 days ago
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0] // Today
  })
  const [orderMetric] = useState<'screenPageViews'|'activeUsers'|'sessions'>('screenPageViews')
  const [allSitesLeaderboard, setAllSitesLeaderboard] = useState<LeaderboardRow[]>([])
  const [loadingAllSitesLeaderboard, setLoadingAllSitesLeaderboard] = useState<boolean>(false)
  const [prevStats, setPrevStats] = useState<{ activeUsers: number; screenPageViews: number } | null>(null);
  const [loadingPrevStats, setLoadingPrevStats] = useState<boolean>(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false)
  const [aliasMap, setAliasMap] = useState<Record<string, Record<string, string>>>({})
  const [groupsMap, setGroupsMap] = useState<Record<string, string[]>>({})
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [report, setReport] = useState<Report | null>(null)
  const [loadingReport, setLoadingReport] = useState<boolean>(false)
  const [errorState, setErrorState] = useState<string>('')
  const error = errorState;
  const setError = (msg: string | null | undefined) => {
    if (msg && typeof msg === 'string' && (msg.includes('<!DOCTYPE html>') || msg.includes('502.') || msg.includes('<html'))) {
      setErrorState('Máy chủ Google Analytics đang tạm thời quá tải hoặc gặp sự cố (Lỗi 502). Vui lòng đổi ngày/chọn lại site hoặc thử lại sau vài giây.');
    } else {
      setErrorState(msg || '');
    }
  };
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { t, i18n } = useTranslation()

  // Update document title dynamically
  useEffect(() => {
    document.title = t('leaderboard.team_title', 'Bảng xếp hạng theo nhóm');
  }, [t, i18n.language]);

  // UI States
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // AI Analysis States
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiTitle, setAiTitle] = useState('');

  useEffect(() => {
    api('/api/sites').then(r => r.json()).then(data => {
      setSites(data.sites || [])
      if ((data.sites || []).length > 0) setSiteId(data.sites[0].id)
    })
    api('/api/aliasMap').then(r => r.json()).then(data => {
      setAliasMap(data.aliasMap || {})
    }).catch(err => {
      console.error('Failed to load alias map:', err)
    })
    api('/api/groups').then(r => r.json()).then(data => {
      setGroupsMap(data.groups || {})
    }).catch(err => {
      console.error('Failed to load groups map:', err)
    })
  }, [])

  // Theme Logic
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark')

  const toggleLanguage = () => {
    const newLang = i18n.language === 'vi' ? 'en' : 'vi'
    i18n.changeLanguage(newLang)
  }

  const canRun = useMemo(() => siteId && startDate && endDate, [siteId, startDate, endDate])
  const canRunAll = useMemo(() => startDate && endDate, [startDate, endDate])

  async function loadAllSitesLeaderboard(signal?: AbortSignal) {
    if (!canRunAll) return
    setError('')
    setLoadingAllSitesLeaderboard(true)
    setAllSitesLeaderboard([])
    try {
      const MAX_DAYS_PER_CHUNK = 10
      const start = new Date(startDate)
      const end = new Date(endDate)
      const chunks: { start: string; end: string }[] = []

      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
        const cur = new Date(start)
        while (cur <= end) {
          const chunkStart = new Date(cur)
          const chunkEnd = new Date(cur)
          chunkEnd.setDate(chunkEnd.getDate() + MAX_DAYS_PER_CHUNK - 1)
          if (chunkEnd > end) chunkEnd.setTime(end.getTime())
          chunks.push({
            start: chunkStart.toISOString().split('T')[0],
            end: chunkEnd.toISOString().split('T')[0],
          })
          cur.setDate(cur.getDate() + MAX_DAYS_PER_CHUNK)
        }
      } else {
        chunks.push({ start: startDate, end: endDate })
      }

      type AggRow = {
        activeUsers: number
        sessions: number
        screenPageViews: number
        totalEngagementTime: number
        eventCount: number
        conversions: number
        totalRevenue: number
      }
      const aggMap: Record<string, AggRow> = {}

      // Aggregate kết quả từ nhiều chunks song song
      await Promise.all(chunks.map(async (c) => {
        const url = `/api/leaderboard/all?startDate=${encodeURIComponent(c.start)}&endDate=${encodeURIComponent(c.end)}&orderMetric=${encodeURIComponent(orderMetric)}&mode=alias`
        const r = await api(url, { signal })
        const data = await r.json()
        if (data.error) {
          throw new Error(data.error);
        }
        const rows: LeaderboardRow[] = data.rows || []
        for (const row of rows) {
          const id = row.employeeId
          if (!aggMap[id]) {
            aggMap[id] = {
              activeUsers: 0,
              sessions: 0,
              screenPageViews: 0,
              totalEngagementTime: 0,
              eventCount: 0,
              conversions: 0,
              totalRevenue: 0,
            }
          }
          aggMap[id].activeUsers += row.activeUsers
          aggMap[id].sessions += row.sessions
          aggMap[id].screenPageViews += row.screenPageViews
          aggMap[id].totalEngagementTime += row.averageEngagementTime * row.activeUsers
          aggMap[id].eventCount += row.eventCount
          aggMap[id].conversions += row.conversions
          aggMap[id].totalRevenue += row.totalRevenue
        }
      }));

      const merged: LeaderboardRow[] = Object.entries(aggMap).map(([employeeId, v], idx) => {
        const viewsPerUser = v.activeUsers > 0 ? v.screenPageViews / v.activeUsers : 0
        const avgEngTime = v.activeUsers > 0 ? v.totalEngagementTime / v.activeUsers : 0
        return {
          employeeId,
          activeUsers: v.activeUsers,
          sessions: v.sessions,
          screenPageViews: v.screenPageViews,
          viewsPerActiveUser: viewsPerUser,
          averageEngagementTime: avgEngTime,
          eventCount: v.eventCount,
          conversions: v.conversions,
          totalRevenue: v.totalRevenue,
          rank: idx + 1,
        }
      })
      const sorted = merged
        .filter(row => {
          const name = getEmployeeName(row.employeeId).toLowerCase().trim();
          const id = row.employeeId.toLowerCase().trim();
          const isExact = EXCLUDED_USERS_EXACT.some(ex => name === ex || id === ex);
          const isPartial = EXCLUDED_USERS.some(ex => name.includes(ex) || id.includes(ex));

          let inAliasMap = false;
          for (const siteIdKey in aliasMap) {
            const siteMap = aliasMap[siteIdKey];
            for (const alias in siteMap) {
              const empName = siteMap[alias].toLowerCase().trim();
              const aliasLower = alias.toLowerCase().trim();
              if (name === empName || name === aliasLower || id === empName || id === aliasLower) {
                inAliasMap = true;
                break;
              }
            }
            if (inAliasMap) break;
          }

          return !isExact && !isPartial && inAliasMap;
        })
        .sort((a, b) => b[orderMetric] - a[orderMetric])
        .map((row, idx) => ({ ...row, rank: idx + 1 }))

      setAllSitesLeaderboard(sorted)
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (e.name === 'AbortError') return;
      setError(e.message)
    } finally {
      setLoadingAllSitesLeaderboard(false)
    }
  }

  async function loadLeaderboard(signal?: AbortSignal) {
    if (!canRun) return
    setError('')
    setLoadingLeaderboard(true)
    try {
      const url = `/api/leaderboard?propertyId=${encodeURIComponent(siteId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&orderMetric=${encodeURIComponent(orderMetric)}&mode=alias`
      const r = await api(url, { signal })
      const data = await r.json()
      if (data.error) { setError(data.error); setLoadingLeaderboard(false); return }
      
      const rows = data.rows || []
      const sorted = rows
        .filter((row: LeaderboardRow) => {
          const name = getEmployeeName(row.employeeId).toLowerCase().trim();
          const id = row.employeeId.toLowerCase().trim();
          const isExact = EXCLUDED_USERS_EXACT.some(ex => name === ex || id === ex);
          const isPartial = EXCLUDED_USERS.some(ex => name.includes(ex) || id.includes(ex));

          let inAliasMap = false;
          for (const siteIdKey in aliasMap) {
            const siteMap = aliasMap[siteIdKey];
            for (const alias in siteMap) {
              const empName = siteMap[alias].toLowerCase().trim();
              const aliasLower = alias.toLowerCase().trim();
              if (name === empName || name === aliasLower || id === empName || id === aliasLower) {
                inAliasMap = true;
                break;
              }
            }
            if (inAliasMap) break;
          }

          return !isExact && !isPartial && inAliasMap;
        })
        .sort((a: LeaderboardRow, b: LeaderboardRow) => b[orderMetric] - a[orderMetric])
        .map((row: LeaderboardRow, idx: number) => ({ ...row, rank: idx + 1 }))

      setLeaderboard(sorted)
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (e.name === 'AbortError') return;
      setError(e.message)
    } finally {
      setLoadingLeaderboard(false)
    }
  }

  async function loadReportForEmployee(alias: string, signal?: AbortSignal) {
    setSelectedEmployee(alias)
    setError('')
    setLoadingReport(true)
    setReport(null)
    try {
      const url = `/api/report?propertyId=${encodeURIComponent(siteId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&mode=alias&alias=${encodeURIComponent(alias)}`
      const r = await api(url, { signal })
      const data = await r.json()
      if (data.error) { setError(data.error); setReport(null); return }
      setReport(data)
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (e.name === 'AbortError') return;
      setError(e.message)
    } finally {
      setLoadingReport(false)
    }
  }

  async function askAI(type: 'site' | 'employee') {
    setAiModalOpen(true);
    setAiLoading(true);
    setAiAnalysis(null);
    setAiTitle(type === 'site' ? 'Network Intelligence Analysis' : `Performance Intelligence: ${selectedEmployee}`);
    
    try {
      const data = type === 'site' ? { leaderboard: allSitesLeaderboard } : { report, employeeId: selectedEmployee };
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: siteId, data, type })
      });
      const result = await res.json();
      setAiAnalysis(result.analysis);
    } catch (e) {
      console.error(e);
      setAiAnalysis('An error occurred during AI analysis. Please check server logs.');
    } finally {
      setAiLoading(false);
    }
  }

  async function loadPrevGlobalStats(signal?: AbortSignal) {
    if (!canRunAll) return
    setLoadingPrevStats(true)
    setPrevStats(null)

    try {
      const MAX_DAYS_PER_CHUNK = 10
      const currentStart = new Date(startDate)
      const currentEnd = new Date(endDate)
      
      const diffTime = Math.abs(currentEnd.getTime() - currentStart.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const prevEnd = new Date(currentStart)
      prevEnd.setDate(prevEnd.getDate() - 1)
      
      const prevStart = new Date(prevEnd)
      prevStart.setDate(prevStart.getDate() - diffDays + 1)
      
      const chunks: { start: string; end: string }[] = []
      if (!isNaN(prevStart.getTime()) && !isNaN(prevEnd.getTime()) && prevStart <= prevEnd) {
        const cur = new Date(prevStart)
        while (cur <= prevEnd) {
          const chunkStart = new Date(cur)
          const chunkEnd = new Date(cur)
          chunkEnd.setDate(chunkEnd.getDate() + MAX_DAYS_PER_CHUNK - 1)
          if (chunkEnd > prevEnd) chunkEnd.setTime(prevEnd.getTime())
          chunks.push({
            start: chunkStart.toISOString().split('T')[0],
            end: chunkEnd.toISOString().split('T')[0],
          })
          cur.setDate(cur.getDate() + MAX_DAYS_PER_CHUNK)
        }
      } else {
        chunks.push({ start: prevStart.toISOString().split('T')[0], end: prevEnd.toISOString().split('T')[0] })
      }

      let prevUsers = 0
      let prevViews = 0

      for (const c of chunks) {
        const url = `/api/leaderboard/all?startDate=${encodeURIComponent(c.start)}&endDate=${encodeURIComponent(c.end)}&orderMetric=${encodeURIComponent(orderMetric)}&mode=alias`
        const r = await api(url, { signal })
        const data = await r.json()
        if (data.error) throw new Error(data.error)
        
        const rows = data.rows || []
        for (const row of rows) {
          prevUsers += row.activeUsers || 0
          prevViews += row.screenPageViews || 0
        }
      }
      
      setPrevStats({ activeUsers: prevUsers, screenPageViews: prevViews })
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (e.name === 'AbortError') return;
      console.error("Failed to load prev stats:", e)
    } finally {
      setLoadingPrevStats(false)
    }
  }

  useEffect(() => { 
    const controller = new AbortController();
    if (canRunAll && Object.keys(aliasMap).length > 0) { 
      loadAllSitesLeaderboard(controller.signal).catch(e => {
        if (e.name !== 'AbortError') console.error(e)
      });
      loadPrevGlobalStats(controller.signal).catch(e => {
        if (e.name !== 'AbortError') console.error(e)
      });
    } 
    return () => controller.abort();
  }, [startDate, endDate, orderMetric, aliasMap, canRunAll])
  
  useEffect(() => { 
    const controller = new AbortController();
    if (canRun && Object.keys(aliasMap).length > 0) { 
      loadLeaderboard(controller.signal).catch(e => {
        if (e.name !== 'AbortError') console.error(e)
      });
    } 
    return () => controller.abort();
  }, [siteId, startDate, endDate, orderMetric, aliasMap, canRun])

  const getEmployeeName = (employeeId: string): string => {
    for (const siteIdKey in aliasMap) {
      const siteMap = aliasMap[siteIdKey]
      if (siteMap[employeeId]) return siteMap[employeeId]
      const foundAlias = Object.keys(siteMap).find(alias => siteMap[alias] === employeeId)
      if (foundAlias) return employeeId
    }
    return employeeId
  }

  return (
    <div className="app-layout">
      {/* Sidebar Overlay for Mobile */}
      {showMobileMenu && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setShowMobileMenu(false)}
        />
      )}

      <aside className={`sidebar ${showMobileMenu ? 'show' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-text">
            <img src="/winners-media-logo-dark.png" alt="Winners Media" style={{ height: '48px', objectFit: 'contain' }} />
          </div>
          {showMobileMenu && (
            <button className="mobile-close" onClick={() => setShowMobileMenu(false)}>
              <X size={20} />
            </button>
          )}
        </div>
        
        <div className="sidebar-nav">
            <NavItem icon={LayoutDashboard} label={t('common.dashboard')} active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setShowMobileMenu(false); }} />
            <NavItem icon={Clock} label={t('common.realtime')} active={activeTab === 'realtime'} onClick={() => { setActiveTab('realtime'); setShowMobileMenu(false); }} />
            <NavItem 
            icon={TrendingUp} 
            label={t('common.radar')} 
            active={activeTab === 'radar'} 
            onClick={() => { setActiveTab('radar'); setShowMobileMenu(false); }} 
          />
          <NavItem 
            icon={Sparkles} 
            label={t('common.lab')} 
            active={activeTab === 'lab'} 
            onClick={() => { setActiveTab('lab'); setShowMobileMenu(false); }} 
          />
          <NavItem 
            icon={BrainCircuit} 
            label={t('common.coach')} 
            active={activeTab === 'coach'} 
            onClick={() => { setActiveTab('coach'); setShowMobileMenu(false); }} 
          />
        </div>

        <div className="sidebar-footer">
          <NavItem icon={Settings} label={t('common.settings')} />
          <NavItem icon={HelpCircle} label={t('common.help')} />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="header">
          <div className="header-left">
            <button className="mobile-menu-toggle" onClick={() => setShowMobileMenu(true)}>
              <Menu size={24} />
            </button>
            <div className="page-title">
              <h1>{activeTab === 'dashboard' ? t('common.dashboard') : activeTab === 'realtime' ? t('common.realtime') : activeTab === 'radar' ? t('common.radar') : activeTab === 'lab' ? t('common.lab') : t('common.coach')}</h1>
              <p>{t('common.welcome')}</p>
            </div>
          </div>

          <div className="header-actions">
            <div className="controls-bar glass">
              <div className="date-inputs">
                <DateRangePicker 
                   startDate={startDate} 
                   endDate={endDate} 
                   onChange={(start, end) => {
                     setStartDate(start);
                     setEndDate(end);
                   }}
                 />
              </div>
              <div className="control-item site-selector">
                <SiteSelector sites={sites} siteId={siteId} onChange={setSiteId} />
              </div>

              <div className="control-divider"></div>

              <button className="drp-trigger" onClick={toggleTheme} title={t('common.toggle_theme')} style={{ minWidth: '46px', padding: '6px 12px' }}>
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <button className="drp-trigger" onClick={toggleLanguage} title={t('common.language')} style={{ minWidth: '64px', padding: '6px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 'bold' }}>
                  <Globe size={18} />
                  <span>{i18n.language === 'vi' ? 'EN' : 'VI'}</span>
                </div>
              </button>
            </div>
            
            <button className="btn-ai" onClick={() => askAI('site')}>
              <Sparkles size={18} />
              <span>{t('common.insight_ai')}</span>
            </button>
          </div>
        </header>

        {error && <div className="error glass" style={{ padding: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', color: '#fca5a5', marginBottom: '24px' }}>{error}</div>}

        {activeTab === 'dashboard' && (() => {
          const currentNetworkUsers = allSitesLeaderboard.reduce((acc, r) => acc + (r.activeUsers || 0), 0);
          const currentTotalViews = allSitesLeaderboard.reduce((acc, r) => acc + (r.screenPageViews || 0), 0);
          
          const calculateChange = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return ((current - previous) / previous) * 100;
          };

          const usersChange = prevStats ? calculateChange(currentNetworkUsers, prevStats.activeUsers) : 0;
          const viewsChange = prevStats ? calculateChange(currentTotalViews, prevStats.screenPageViews) : 0;

          return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Global Stats Summary */}
            <div className="stats-grid">
              <div className="card glass">
                <div className="card-title">
                  <span>{t('stats.network_users')}</span>
                  <UserCircle size={18} className="text-indigo-400" />
                </div>
                <div className="stat-value">
                  {currentNetworkUsers.toLocaleString()}
                  {loadingPrevStats ? (
                     <div className="spinner" style={{ width: 16, height: 16, borderLeftColor: '#94a3b8', borderWidth: 2, marginLeft: 8 }}></div>
                  ) : prevStats && (
                    <span className={`stat-trend ${usersChange > 0 ? 'trend-up' : usersChange < 0 ? 'trend-down' : 'trend-neutral'}`}>
                      {usersChange > 0 ? '+' : ''}{usersChange.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="card glass">
                <div className="card-title">
                  <span>{t('stats.page_views')}</span>
                  <BarChart3 size={18} className="text-cyan-400" />
                </div>
                <div className="stat-value">
                  {currentTotalViews.toLocaleString()}
                  {loadingPrevStats ? (
                     <div className="spinner" style={{ width: 16, height: 16, borderLeftColor: '#94a3b8', borderWidth: 2, marginLeft: 8 }}></div>
                  ) : prevStats && (
                    <span className={`stat-trend ${viewsChange > 0 ? 'trend-up' : viewsChange < 0 ? 'trend-down' : 'trend-neutral'}`}>
                      {viewsChange > 0 ? '+' : ''}{viewsChange.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="card glass">
                <div className="card-title">
                  <span>{t('stats.avg_engagement')}</span>
                  <Clock size={18} className="text-purple-400" />
                </div>
                <div className="stat-value">
                  {formatTime(allSitesLeaderboard.reduce((acc, r) => acc + (r.averageEngagementTime || 0), 0) / (allSitesLeaderboard.length || 1))}
                </div>
              </div>
            </div>

            {/* Leaderboard Section */}
            <section className="card glass">
              <div className="section-header">
                <h2>{t('leaderboard.title')}</h2>
                <div className="header-actions">
                   <span className="text-muted text-sm">{t('leaderboard.all_properties')}</span>
                </div>
              </div>
              
              {loadingAllSitesLeaderboard ? (
                <div className="py-20 text-center"><div className="spinner"></div></div>
              ) : (
                <div className="data-table-container" style={{ maxHeight: '620px', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg-sidebar, #0f172a)' }}>
                      <tr>
                        <th style={{ textAlign: 'center' }}>{t('leaderboard.rank')}</th>
                        <th>{t('leaderboard.user')}</th>
                        <th>{t('common.views')}</th>
                        <th>{t('stats.network_users')}</th>
                        <th>{t('leaderboard.engagement')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSitesLeaderboard.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '32px' }}>
                              {idx < 3 ? (
                                <Trophy 
                                  size={idx === 0 ? 24 : 20} 
                                  style={{ 
                                    color: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : '#b45309',
                                    filter: idx === 0 ? 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.4))' : 'none'
                                  }} 
                                />
                              ) : (
                                <span style={{ fontWeight: 700, color: '#64748b', fontSize: '13px' }}>#{idx + 1}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', fontWeight: 700, fontSize: '12px' }}>
                                {getEmployeeName(row.employeeId).substring(0, 2).toUpperCase()}
                              </div>
                              <span style={{ fontWeight: 500 }}>{getEmployeeName(row.employeeId)}</span>
                            </div>
                          </td>
                          <td>{row.screenPageViews.toLocaleString()}</td>
                          <td>{row.activeUsers.toLocaleString()}</td>
                          <td>{formatTime(row.averageEngagementTime)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Team Leaderboard Section */}
            {!loadingAllSitesLeaderboard && allSitesLeaderboard.length > 0 && Object.keys(groupsMap).length > 0 && (
              <TeamLeaderboard 
                leaderboard={allSitesLeaderboard}
                getEmployeeName={getEmployeeName}
                groupsMap={groupsMap}
                t={t}
              />
            )}

            {/* Entity Breakdown Grid */}
            <div className="dashboard-grid">
               <section className="card glass">
                <div className="section-header">
                  <h2>{t('drilldown.site_distribution')}</h2>
                  <BarChart3 size={20} className="text-muted" />
                </div>
                <div className="chart-container" style={{ height: '300px' }}>
                  {loadingLeaderboard ? (
                    <div className="py-20 text-center"><div className="spinner"></div></div>
                  ) : (
                    <Bar
                      data={{
                        labels: leaderboard.slice(0, 10).map(r => getEmployeeName(r.employeeId)),
                        datasets: [{
                          label: t('stats.page_views'),
                          data: leaderboard.slice(0, 10).map(r => r.screenPageViews),
                          backgroundColor: 'rgba(99, 102, 241, 0.4)',
                          borderColor: '#6366f1',
                          borderWidth: 1,
                          borderRadius: 6,
                        }]
                      }}
                      options={{ 
                        responsive: true, 
                        maintainAspectRatio: false, 
                        plugins: { legend: { display: false } },
                        scales: {
                          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                          x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                        }
                      }}
                    />
                  )}
                </div>
              </section>

              <section className="card glass">
                <div className="section-header">
                  <h2>{t('drilldown.title')}</h2>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {selectedEmployee && (
                      <button className="ai-btn-small" onClick={() => askAI('employee')}>AI Insight</button>
                    )}
                  </div>
                </div>
                
                <div className="data-table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                   {loadingReport ? <div className="spinner"></div> : report ? (
                     <table className="data-table">
                       <thead>
                         <tr>
                           <th>Page Path</th>
                           <th className="text-right">Views</th>
                         </tr>
                       </thead>
                       <tbody>
                         {report.byPageAndScreen.slice(0, 10).map((row, idx) => (
                           <tr key={idx}>
                             <td>
                               <div className="path-text" title={row.pagePath}>
                                 {row.pagePath}
                               </div>
                             </td>
                             <td className="text-right font-bold">{row.screenPageViews.toLocaleString()}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   ) : (
                    <div className="text-muted text-center py-10">{t('drilldown.select_entity')}</div>
                   )}
                </div>
                <div style={{ marginTop: '20px' }}>
                   <h3>{t('drilldown.top_performance')}</h3>
                   {loadingLeaderboard ? (
                     <div className="py-20 text-center"><div className="spinner"></div></div>
                   ) : (
                     <div className="data-table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <table className="data-table">
                          <tbody>
                            {leaderboard.map((row, i) => (
                              <tr key={i} onClick={() => loadReportForEmployee(row.employeeId)} className="cursor-pointer">
                                <td>{getEmployeeName(row.employeeId)}</td>
                                <td className="text-right font-bold text-indigo-400">{row.screenPageViews.toLocaleString()}</td>
                                <td className="text-right"><ChevronRight size={14} className="text-muted" /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                     </div>
                   )}
                </div>
              </section>
            </div>
          </div>
          );
        })()}

        {activeTab === 'realtime' && <RealtimeView propertyId={siteId} />}
        {activeTab === 'radar' && <TrendRadarView propertyId={siteId} />}
        {activeTab === 'lab' && <AIContentLab propertyId={siteId} />}
        {activeTab === 'coach' && <AICoachView propertyId={siteId} employeeId={selectedEmployee} />}
      </main>

      {/* AI Analysis Overlay */}
      {aiModalOpen && (
        <AIAnalysisModal 
          isOpen={aiModalOpen} 
          onClose={() => setAiModalOpen(false)} 
          loading={aiLoading} 
          analysis={aiAnalysis} 
          title={aiTitle} 
        />
      )}
    </div>
  )
}

export default App
