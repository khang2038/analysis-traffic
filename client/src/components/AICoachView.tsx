import React, { useState, useEffect } from 'react';
import { BrainCircuit, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AICoachViewProps {
  propertyId: string;
  employeeId?: string;
}

const AICoachView: React.FC<AICoachViewProps> = ({ propertyId, employeeId }) => {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  
  const [predTopic, setPredTopic] = useState('');
  const [predTime, setPredTime] = useState(9);
  const [prediction, setPrediction] = useState<any>(null);
  const [loadingPred, setLoadingPred] = useState(false);
  const { t } = useTranslation();

  const getCoachAdvice = async () => {
    setLoadingAdvice(true);
    try {
      const res = await fetch(`/api/ai/coach?propertyId=${propertyId}&employeeId=${employeeId || 'Global'}`);
      const data = await res.json();
      setAdvice(data.advice);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAdvice(false);
    }
  };

  const predictTraffic = async () => {
    if (!predTopic) return;
    setLoadingPred(true);
    try {
      const res = await fetch('/api/ai/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: predTopic, time: predTime })
      });
      const data = await res.json();
      setPrediction(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPred(false);
    }
  };

  useEffect(() => {
    getCoachAdvice();
  }, [employeeId, propertyId]);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div className="dashboard-grid">
         {/* Employee AI Coach */}
         <section className="card glass">
            <div className="section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                 <div style={{ padding: '12px', borderRadius: '16px', background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8' }}>
                    <BrainCircuit size={24} />
                 </div>
                 <div>
                    <h2 style={{ margin: 0 }}>{t('coach.title')}</h2>
                    <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                      {employeeId ? t('coach.consulting', { name: employeeId }) : t('coach.global')}
                    </p>
                 </div>
              </div>
              <button 
                className="btn-ai-small" 
                onClick={getCoachAdvice}
                disabled={loadingAdvice}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                <RefreshCw size={14} className={loadingAdvice ? 'animate-spin' : ''} />
                <span>{t('coach.refresh')}</span>
              </button>
            </div>
            
            <div style={{ marginTop: '24px' }}>
              {loadingAdvice ? (
                <div style={{ padding: '60px 0', textAlign: 'center' }}>
                  <div className="spinner"></div>
                  <p style={{ marginTop: '16px', color: '#64748b' }}>{t('coach.reviewing')}</p>
                </div>
              ) : (
                <div style={{ background: 'rgba(15, 23, 42, 0.4)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '15px', lineHeight: '1.7', color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
                    {advice ? advice : t('coach.no_data')}
                  </div>
                </div>
              )}
            </div>
         </section>

         {/* Predictive Traffic Model */}
         <section className="card glass">
            <div className="section-header">
               <div>
                  <h2 style={{ margin: 0 }}>{t('coach.predictive_intel')}</h2>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>{t('coach.forecast_sub')}</p>
               </div>
               <TrendingUp className="text-purple-400" size={20} />
            </div>
            
            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>{t('coach.article_topic')}</label>
                <input 
                  type="text" 
                  className="control-input"
                  style={{ width: '100%' }}
                  value={predTopic} 
                  onChange={(e) => setPredTopic(e.target.value)}
                  placeholder="e.g., iPhone 15 Pro Review..."
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>{t('coach.publish_time')}</label>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#818cf8' }}>{predTime}:00</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="23" 
                  style={{ accentColor: '#6366f1' }}
                  value={predTime} 
                  onChange={(e) => setPredTime(parseInt(e.target.value))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
                   <span>00h</span>
                   <span>12h</span>
                   <span>23h</span>
                </div>
              </div>

              <button 
                className="btn-ai" 
                onClick={predictTraffic} 
                disabled={loadingPred || !predTopic}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {loadingPred ? <div className="spinner" style={{ width: '16px', height: '16px' }}></div> : <Sparkles size={18} />}
                <span>{loadingPred ? t('coach.calculating') : t('coach.forecast')}</span>
              </button>

              {prediction && (
                <div className="fade-in" style={{ marginTop: '12px', background: 'rgba(168, 85, 247, 0.05)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(168, 85, 247, 0.1)', textAlign: 'center' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{ display: 'block', fontSize: '32px', fontWeight: 800, color: '#a855f7', lineHeight: 1 }}>{prediction.predictedViews.toLocaleString()}</span>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimated Views</span>
                  </div>
                  <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5 }}>{prediction.reason}</p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#10b981', width: `${prediction.confidence * 100}%`, borderRadius: '3px' }}></div>
                    </div>
                    <span style={{ fontSize: '10px', color: '#64748b', textAlign: 'left' }}>{t('coach.confidence')}: {prediction.confidence * 100}%</span>
                  </div>
                </div>
              )}
            </div>
         </section>
      </div>
    </div>
  );
};

export default AICoachView;
