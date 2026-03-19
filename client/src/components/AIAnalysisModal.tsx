import React from 'react';

interface AIAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  analysis: string | null;
  title: string;
  link?: string | null;
}

const AIAnalysisModal: React.FC<AIAnalysisModalProps> = ({ isOpen, onClose, loading, analysis, title, link }) => {
  if (!isOpen) return null;

  return (
    <div className="ai-modal-overlay">
      <div className="ai-modal-container">
        <div className="ai-modal-header">
          <div className="ai-header-content">
            <span className="ai-sparkle">✨</span>
            <h3>{title}</h3>
          </div>
          <button className="ai-close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div className="ai-modal-body">
          {loading ? (
            <div className="ai-loading">
              <div className="ai-spinner"></div>
              <p>Gemini đang phân tích dữ liệu...</p>
            </div>
          ) : (
            <div className="ai-content">
              {analysis ? (
                <div className="ai-markdown-rendered">
                  {analysis.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              ) : (
                <p>Không có dữ liệu phân tích.</p>
              )}
            </div>
          )}
        </div>
        
        <div className="ai-modal-footer">
          {link && (
            <a href={link} target="_blank" rel="noopener noreferrer" className="ai-secondary-btn" style={{ marginRight: 'auto' }}>
              🔗 Xem bài viết gốc
            </a>
          )}
          <button className="ai-primary-btn" onClick={onClose}>Đóng</button>
        </div>
      </div>

      <style>{`
        .ai-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .ai-modal-container {
          background: #1e293b;
          border-radius: 20px;
          width: 100%;
          max-width: 700px;
          max-height: 85vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.1);
          animation: modalAppear 0.3s ease-out;
        }

        @keyframes modalAppear {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .ai-modal-header {
          padding: 20px 24px;
          background: linear-gradient(90deg, #6366f1 0%, #a855f7 100%);
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: white;
        }

        .ai-header-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ai-header-content h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .ai-sparkle {
          font-size: 1.5rem;
        }

        .ai-close-btn {
          background: none;
          border: none;
          color: white;
          font-size: 2rem;
          cursor: pointer;
          line-height: 1;
          opacity: 0.8;
          transition: 0.2s;
        }

        .ai-close-btn:hover {
          opacity: 1;
          transform: rotate(90deg);
        }

        .ai-modal-body {
          padding: 32px;
          overflow-y: auto;
          color: #e2e8f0;
          line-height: 1.7;
          flex-grow: 1;
        }

        .ai-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 0;
          gap: 20px;
        }

        .ai-spinner {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(99, 102, 241, 0.1);
          border-left-color: #6366f1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .ai-content {
          font-size: 1.05rem;
        }

        .ai-markdown-rendered p {
          margin-bottom: 16px;
        }

        .ai-modal-footer {
          padding: 20px 24px;
          background: #0f172a;
          display: flex;
          justify-content: flex-end;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .ai-primary-btn {
          background: #6366f1;
          color: white;
          padding: 10px 24px;
          border-radius: 10px;
          border: none;
          font-weight: 600;
          cursor: pointer;
          transition: 0.3s;
        }

        .ai-primary-btn:hover {
          background: #4f46e5;
          box-shadow: 0 0 15px rgba(99, 102, 241, 0.4);
        }

        .ai-secondary-btn {
          background: rgba(255, 255, 255, 0.1);
          color: #e2e8f0;
          padding: 10px 24px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          text-decoration: none;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: 0.3s;
        }

        .ai-secondary-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          color: white;
        }
      `}</style>
    </div>
  );
};

export default AIAnalysisModal;
