import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import HistoryDetailModal from '../components/HistoryDetailModal';
import './HistoryPage.css';
import BackButton from '../components/BackButton';

const HistoryPage = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const { getAuthHeaders } = useAuth();

  // 이용 내역 조회
  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const authHeaders = await getAuthHeaders();
      const response = await apiService.getHistory(authHeaders);
      setHistory(response.history || []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
      setError('이용 내역을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // 내역 삭제
  const handleDeleteHistory = async (historyId) => {
    if (!window.confirm('이 내역을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const authHeaders = await getAuthHeaders();
      await apiService.deleteHistory(historyId, authHeaders);
      
      // 목록에서 삭제된 항목 제거
      setHistory(prev => prev.filter(item => item.id !== historyId));
      
      // 모달이 열려있고 삭제된 항목과 같다면 모달 닫기
      if (selectedHistory && selectedHistory.id === historyId) {
        setShowModal(false);
        setSelectedHistory(null);
      }
      
    } catch (error) {
      console.error('Failed to delete history:', error);
      alert('내역 삭제에 실패했습니다.');
    }
  };

  // 상세 보기
  const handleViewDetail = (historyItem) => {
    setSelectedHistory(historyItem);
    setShowModal(true);
  };

  // 감정 결과 표시 형식
  const formatEmotion = (emotions) => {
    if (Array.isArray(emotions) && emotions.length > 0) {
      return emotions.join(', ');
    }
    return emotions || '감정 분석 결과 없음';
  };

  // 날짜 포맷팅
  const formatDate = (timestamp) => {
    if (!timestamp) return '날짜 정보 없음';
    try {
      return new Date(timestamp).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '날짜 정보 없음';
    }
  };

  if (loading) {
    return (
      <div className="history-container">
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="history-container">
      <div className="history-card">
        <div className="history-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="history-title">나의 이용내역</h1>
            <p className="history-subtitle">
              총 {history.length}개의 추천 내역이 있습니다
            </p>
          </div>
          <BackButton />
        </div>

        {error && <div className="error-message">{error}</div>}

        {history.length === 0 ? (
          <div className="empty-state">
            <p>아직 이용 내역이 없습니다.</p>
            <p>AI 산책로 추천 서비스를 이용해보세요!</p>
          </div>
        ) : (
          <div className="history-list">
            {history.map((item) => (
              <div key={item.id} className="history-item">
                <div className="history-preview">
                  <div className="history-date">
                    {formatDate(item.timestamp)}
                  </div>
                  
                  <div className="history-emotion">
                    <span className="emotion-label">감정 분석:</span>
                    <span className="emotion-value">
                      {formatEmotion(item.emotions || item.emotion)}
                    </span>
                  </div>
                  
                  <div className="history-trails">
                    <span className="trails-label">추천 산책로:</span>
                    <span className="trails-value">
                      {item.trails && item.trails.length > 0 
                        ? `${item.trails[0].name} 외 ${item.trails.length - 1}곳`
                        : '산책로 정보 없음'}
                    </span>
                  </div>
                </div>
                
                <div className="history-actions">
                  <button 
                    className="view-button"
                    onClick={() => handleViewDetail(item)}
                  >
                    상세보기
                  </button>
                  <button 
                    className="delete-button"
                    onClick={() => handleDeleteHistory(item.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 상세보기 모달 */}
      {showModal && selectedHistory && (
        <HistoryDetailModal
          history={selectedHistory}
          onClose={() => {
            setShowModal(false);
            setSelectedHistory(null);
          }}
          onDelete={handleDeleteHistory}
        />
      )}
    </div>
  );
};

export default HistoryPage;
