import React, { useEffect, useState, useRef } from 'react';
import { Users, Globe, Pointer, MapPin, RefreshCw, Facebook, Search, Link as LinkIcon, Youtube, Twitter, Instagram } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const getSourceIcon = (source: string) => {
  const s = source.toLowerCase();
  if (s.includes('facebook') || s.includes('fb')) return <Facebook size={16} className="text-blue-500" />;
  if (s.includes('google') || s.includes('bing') || s.includes('yahoo') || s.includes('search')) return <Search size={16} className="text-green-500" />;
  if (s.includes('twitter') || s.includes('t.co') || s.includes('x.com')) return <Twitter size={16} className="text-blue-400" />;
  if (s.includes('youtube')) return <Youtube size={16} className="text-red-500" />;
  if (s.includes('instagram') || s.includes('ig')) return <Instagram size={16} className="text-pink-500" />;
  if (s.includes('direct')) return <LinkIcon size={16} className="text-gray-400" />;
  return <Globe size={16} className="text-muted" />;
};

interface RealtimeData {
  activeUsers: number;
  byPage: Array<{ title: string; path: string; activeUsers: number; views: number }>;
  bySource: Array<{ source: string; medium: string; activeUsers: number }>;
  byCity: Array<{ country: string; city: string; countryId?: string; activeUsers: number }>;
  isFallback?: boolean;
}

interface RealtimeViewProps {
  propertyId: string;
}

const RealtimeView: React.FC<RealtimeViewProps> = ({ propertyId }) => {
  const [data, setData] = useState<RealtimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { t } = useTranslation();
  const timerRef = useRef<any>(null);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/realtime?propertyId=${propertyId}`);
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch realtime data', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();

    // Auto refresh every 30 seconds
    timerRef.current = setInterval(fetchData, 30000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [propertyId]);

  if (loading && !data) {
    return (
      <div className="flex-center py-40">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="fade-in flex flex-col gap-8">
      {/* Realtime Stats Summary */}
      <div className="stats-grid">
        <div className="card glass relative overflow-hidden">
          <div className="card-title">
            <div className="flex flex-col">
              <span>{t('realtime.active_users')}</span>
              {data?.isFallback && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full mt-1 w-fit">
                  {t('realtime.recent_activity')}
                </span>
              )}
            </div>
            <Users size={18} className="text-blue-400" />
          </div>
          <div className="flex flex-col mt-4">
            <span className="text-6xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              {data?.activeUsers || 0}
            </span>
            <span className="text-sm text-muted mt-2">
              {data?.isFallback ? t('realtime.today_so_far') : t('realtime.last_30_mins')}
            </span>
          </div>
          <div className="absolute top-0 right-0 p-4">
               <div className="flex items-center gap-2 text-xs text-muted">
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                  <span>{lastUpdated.toLocaleTimeString()}</span>
               </div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Top Pages */}
        <section className="card glass">
          <div className="section-header">
            <h2>{t('realtime.top_pages')}</h2>
            <Globe size={20} className="text-muted" />
          </div>
          <div className="data-table-container mt-6 overflow-y-auto max-h-[400px] custom-scrollbar pr-1">
            <table className="data-table table-fixed w-full">
              <thead className="sticky-header">
                <tr>
                  <th className="w-12 text-center text-muted">#</th>
                  <th className="w-full">{t('realtime.page')}</th>
                  <th className="w-24 text-right">{t('realtime.active')}</th>
                  <th className="w-24 text-right">{t('common.views')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.byPage.slice(0, 10).map((p, i) => (
                  <tr key={i}>
                    <td className="text-center text-muted font-medium text-sm">{i + 1}</td>
                    <td className="w-full max-w-0">
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-semibold block truncate" title={p.title}>{p.title || p.path}</span>
                        <span className="text-xs text-muted block truncate mt-1" title={p.path}>{p.path}</span>
                      </div>
                    </td>
                    <td className="text-right font-bold text-blue-400">{p.activeUsers}</td>
                    <td className="text-right font-medium">{p.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Sources and Cities */}
        <div className="flex flex-col gap-8">
          <section className="card glass">
            <div className="section-header">
              <h2>{t('realtime.top_sources')}</h2>
              <Pointer size={20} className="text-muted" />
            </div>
            <div className="list-container">
              {data?.bySource.map((s, i) => (
                <div key={i} className="list-item">
                  <div className="list-item-left">
                    <div className="list-item-icon">
                      {getSourceIcon(s.source)}
                    </div>
                    <div className="list-item-text">
                      <span className="list-item-title" title={s.source}>{s.source}</span>
                      <span className="list-item-subtitle" title={s.medium}>{s.medium}</span>
                    </div>
                  </div>
                  <span className="list-item-value">{s.activeUsers}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card glass">
            <div className="section-header">
              <h2>{t('realtime.top_locations')}</h2>
              <MapPin size={20} className="text-muted" />
            </div>
            <div className="list-container">
              {data?.byCity.slice(0, 5).map((l, i) => (
                <div key={i} className="list-item">
                  <div className="list-item-left">
                    <div className="list-item-icon" style={{ background: 'transparent' }} title={l.country}>
                       {l.countryId ? (
                         <img 
                           src={`https://flagcdn.com/w40/${l.countryId.toLowerCase()}.png`} 
                           alt={l.country}
                           className="w-6 h-4 object-cover rounded-sm shadow-sm"
                           loading="lazy"
                         />
                       ) : '🌐'}
                    </div>
                    <div className="list-item-text">
                      <span className="list-item-title" title={l.city}>{l.city || 'Unknown'}</span>
                      <span className="list-item-subtitle">{l.country}</span>
                    </div>
                  </div>
                  <span className="list-item-value">{l.activeUsers}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default RealtimeView;
