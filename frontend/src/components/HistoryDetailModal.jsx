import React from 'react';
import './HistoryDetailModal.css';

const HistoryDetailModal = ({ history, onClose, onDelete }) => {
  const handleDelete = () => {
    if (window.confirm('이 내역을 삭제하시겠습니까?')) {
      onDelete(history.id);
    }
  };

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

  const formatEmotion = (emotions) => {
    if (Array.isArray(emotions) && emotions.length > 0) {
      return emotions.join(', ');
    }
    return emotions || '감정 분석 결과 없음';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">추천 내역 상세보기</h2>
          <div className="modal-actions">
            <button className="delete-modal-button" onClick={handleDelete}>
              삭제
            </button>
            <button className="close-button" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="modal-body">
          {/* 날짜 */}
          <div className="detail-section">
            <h3 className="section-title">추천 날짜</h3>
            <div className="section-content">
              {formatDate(history.timestamp)}
            </div>
          </div>

          {/* 사용자 입력 프롬프트 */}
          <div className="detail-section">
            <h3 className="section-title">입력한 내용</h3>
            <div className="section-content prompt-content">
              {history.prompt || '입력 내용 없음'}
            </div>
          </div>

          {/* 감정 분석 결과 */}
          <div className="detail-section">
            <h3 className="section-title">감정 분석 결과</h3>
            <div className="section-content emotion-content">
              {formatEmotion(history.emotions || history.emotion)}
            </div>
          </div>

          {/* 공감의 한마디 */}
          <div className="detail-section">
            <h3 className="section-title">공감의 한마디</h3>
            <div className="section-content comfort-content">
              {history.comfort_message || '공감 메시지 없음'}
            </div>
          </div>

          {/* 추천 음악 */}
          <div className="detail-section">
            <h3 className="section-title">추천 음악</h3>
            <div className="section-content">
              {history.recommendations && history.recommendations.length > 0 ? (
                <div className="music-list">
                  {history.recommendations.map((music, index) => (
                    <div key={index} className="music-item">
                      <div className="music-info">
                        <span className="music-title">{music.title}</span>
                        <span className="music-artist">- {music.artist}</span>
                      </div>
                      <div className="music-reason">{music.reason}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div>추천 음악 정보 없음</div>
              )}
            </div>
          </div>

          {/* 추천 산책로 */}
          <div className="detail-section">
            <h3 className="section-title">추천 산책로 (상위 3곳)</h3>
            <div className="section-content">
              {history.trails && history.trails.length > 0 ? (
                <div className="trails-list">
                  {history.trails.map((trail, index) => (
                    <div key={index} className="trail-item">
                      <div className="trail-rank">#{index + 1}</div>
                      <div className="trail-info">
                        <div className="trail-name">{trail.name}</div>
                        <div className="trail-address">{trail.address}</div>
                        <div className="trail-score">매칭도: {trail.score}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div>추천 산책로 정보 없음</div>
              )}
            </div>
          </div>

          {/* 추가 산책로 (있는 경우) */}
          {history.more_trails && history.more_trails.length > 0 && (
            <div className="detail-section">
              <h3 className="section-title">추가 추천 산책로</h3>
              <div className="section-content">
                <div className="trails-list">
                  {history.more_trails.slice(0, 5).map((trail, index) => (
                    <div key={index} className="trail-item">
                      <div className="trail-rank">#{index + 4}</div>
                      <div className="trail-info">
                        <div className="trail-name">{trail.name}</div>
                        <div className="trail-address">{trail.address}</div>
                        <div className="trail-score">매칭도: {trail.score}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryDetailModal;
