import React, { useState } from 'react';
import { Sparkles, Search, FileText, Target, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AIContentLabProps {
  propertyId: string;
}

const AIContentLab: React.FC<AIContentLabProps> = ({ propertyId }) => {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<any>(null);
  const { t } = useTranslation();

  const generateBrief = async () => {
    if (!topic) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          data: { topic },
          type: 'site'
        })
      });
      const data = await res.json();
      setBrief(data.analysis);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div className="lab-grid">
        {/* Brief Generator */}
        <div className="card glass">
          <div className="card-title">
            <span>{t('lab.brief_generator')}</span>
            <Sparkles className="text-indigo-400" size={18} />
          </div>
          
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} size={16} />
                <input 
                  type="text" 
                  className="control-input"
                  style={{ width: '100%', paddingLeft: '36px' }}
                  placeholder={t('lab.placeholder')} 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
              <button 
                className="btn-ai" 
                onClick={generateBrief} 
                disabled={loading || !topic}
                style={{ height: '44px' }}
              >
                {loading ? <div className="spinner" style={{ width: '16px', height: '16px' }}></div> : <FileText size={18} />}
                <span>{loading ? t('lab.generating') : t('lab.generate')}</span>
              </button>
            </div>
            
            {brief ? (
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', borderRadius: '16px', padding: '24px', border: '1px solid rgba(99, 102, 241, 0.2)', maxHeight: '500px', overflowY: 'auto' }}>
                <div style={{ fontSize: '15px', lineHeight: '1.7', color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
                  {brief}
                </div>
              </div>
            ) : (
              <div style={{ padding: '60px 0', textAlign: 'center', border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '16px' }}>
                <FileText size={40} style={{ color: 'rgba(255,255,255,0.1)', marginBottom: '12px' }} />
                <p style={{ color: '#64748b' }}>{t('lab.enter_topic')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Content Gap Section */}
        <div className="card glass h-fit">
          <div className="card-title">
             <span>{t('lab.gap_analyzer')}</span>
             <Target className="text-cyan-400" size={18} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
             <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                   <span style={{ fontSize: '10px', fontWeight: 800, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>{t('lab.high_priority')}</span>
                   <Zap size={14} className="text-red-400" />
                </div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>Digital Finance (Fintech)</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: 1.4 }}>Your site has no new content on this trending topic in the last 30 days.</p>
             </div>

             <div style={{ padding: '16px', borderRadius: '16px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                   <span style={{ fontSize: '10px', fontWeight: 800, background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>{t('lab.opportunity')}</span>
                   <Sparkles size={14} className="text-amber-400" />
                </div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>AI Editor Workflow</h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: 1.4 }}>Search volume up 45%, but you only have basic coverage. Deep-dive suggested.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIContentLab;
