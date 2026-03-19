import React, { useEffect, useState } from 'react';
import { Rocket, AlertTriangle, BarChart3, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Bar } from 'react-chartjs-2';
import AIAnalysisModal from './AIAnalysisModal';

interface TrendRadarProps {
  propertyId: string;
}

const TrendRadarView: React.FC<TrendRadarProps> = ({ propertyId }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const { t } = useTranslation();

  const handleKeywordClick = async (keyword: string, url?: string) => {
    setSelectedKeyword(keyword);
    setSelectedUrl(url || null);
    setModalOpen(true);
    setSummaryLoading(true);
    setSummary(null);

    try {
      const res = await fetch('/api/ai/summarize-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: keyword })
      });
      
      let result;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        result = await res.json();
      } else {
        const text = await res.text();
        console.error('Non-JSON response:', text);
        setSummary('Chức năng này mới được thêm nhưng Backend chưa phản hồi đúng. PHẢI CÓ LỖI: Bạn chưa khởi động lại server. Hãy vào Terminal đang chạy npm run dev, bấm Ctrl + C và chạy lại nhé!');
        return;
      }

      if (!res.ok || result.error) {
        setSummary(`Lỗi từ Server: ${result.error || 'Unknown Error'}`);
      } else {
        setSummary(result.summary);
      }
    } catch (err: any) {
      console.error(err);
      setSummary(`Có lỗi xảy ra: ${err.message || 'Không thể kết nối'}`);
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetch(`/api/ai/trends/radar?propertyId=${propertyId}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [propertyId]);

  if (loading) return (
    <div style={{ padding: '80px 0', textAlign: 'center' }}>
      <div className="spinner"></div>
    </div>
  );

  if (!data) return <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>{t('radar.no_data')}</div>;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="stats-grid">
         {/* Top 10 Keywords */}
         <div className="card glass">
          <div className="card-title">
            <span>{t('radar.keywords')}</span>
            <Rocket className="text-indigo-400" size={18} />
          </div>
          <div className="keyword-list" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
            {data.topKeywords.slice(0, 10).map((kw: any, i: number) => (
              <div 
                key={i} 
                onClick={() => handleKeywordClick(kw.topicKeyword, kw.url)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#818cf8', flexShrink: 0 }}>{i < 9 ? `0${i+1}` : i+1}</span>
                  <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{kw.topicKeyword}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, paddingLeft: '12px' }}>
                   <Zap size={12} className="text-emerald-400" />
                   <span style={{ fontSize: '12px', fontWeight: 700, color: '#34d399' }}>{kw.momentumScore.toFixed(0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Spike Alerts */}
        <div className="card glass">
          <div className="card-title">
            <span>{t('radar.spikes')}</span>
            <AlertTriangle className="text-orange-400" size={18} />
          </div>
          <div className="alert-list" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.alerts.length > 0 ? data.alerts.slice(0, 3).map((alert: any, i: number) => (
              <div key={i} style={{ padding: '12px', borderRadius: '12px', border: '1px solid rgba(251, 146, 60, 0.2)', background: 'rgba(251, 146, 60, 0.05)', display: 'flex', gap: '12px' }}>
                <div style={{ padding: '8px', height: 'fit-content', borderRadius: '8px', background: 'rgba(251, 146, 60, 0.1)', color: '#fb923c' }}>
                   <Zap size={16} />
                </div>
                <div>
                   <p style={{ fontSize: '14px', fontWeight: 500, margin: 0, lineHeight: 1.3 }}>{alert.message}</p>
                   <span style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'inline-block' }}>{new Date(alert.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            )) : (
              <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8' }}>
                <p style={{ fontSize: '14px' }}>{t('radar.no_spikes')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Heatmap Section */}
      <section className="card glass">
        <div className="section-header">
          <div>
            <h2>{t('radar.heatmap')}</h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>{t('radar.heatmap_sub')}</p>
          </div>
          <BarChart3 style={{ color: '#94a3b8' }} size={20} />
        </div>
        
        <div className="heatmap-grid" style={{ marginTop: '20px', height: '300px' }}>
          <Bar
            data={{
              labels: data.heatmap.map((h: any) => `${h.hour}h`),
              datasets: [{
                label: t('common.views') || 'Views',
                data: data.heatmap.map((h: any) => h.score),
                backgroundColor: 'rgba(99, 102, 241, 0.4)',
                borderColor: '#6366f1',
                borderWidth: 1,
                borderRadius: 4,
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
        </div>
      </section>

      {modalOpen && (
        <AIAnalysisModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          loading={summaryLoading}
          analysis={summary}
          title={selectedKeyword ? `Tóm tắt: ${selectedKeyword}` : "Tóm tắt nội dung bài viết"}
          link={selectedUrl}
        />
      )}
    </div>
  );
};

export default TrendRadarView;
