import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import TrailMap from './TrailMap'
import './ResultsDisplay.css'

function Section({ title, children, icon }) {
  return (
    <section className="card section fade-in">
      <div className="section-title">
        {icon && <span className="icon" aria-hidden>🎵</span>}
        <span>{title}</span>
      </div>
      {children}
    </section>
  )
}

export default function ResultsDisplay({ result }) {
  const [selectedTrailForMap, setSelectedTrailForMap] = useState(null)
  const navigate = useNavigate()
  
  if (!result) return null
  const { analysis, trail } = result
  const recs = (analysis && analysis.recommendations) || []
  const keywords = (analysis && analysis.keywords) || []
  const emotions = analysis?.emotions || []
  const emotion = analysis?.emotion || (emotions.length ? emotions.join(', ') : '-')
  const positiveUsed = trail?.positive_emotions_used || []

  // 산책로 선택 시 커뮤니티로 이동 및 쿠폰 발급
  const handleSelectTrail = (selectedTrail) => {
    console.log('[ResultsDisplay] 산책로 선택:', selectedTrail.name)
    
    // 선택한 산책로 정보를 localStorage에 저장
    localStorage.setItem('lastSelectedTrail', JSON.stringify({
      trail: selectedTrail,
      timestamp: new Date().toISOString()
    }))
    
    // 쿠폰 발급 팝업 표시
    const showCouponPopup = () => {
      const popup = document.createElement('div')
      popup.className = 'coupon-popup-overlay'
      popup.innerHTML = `
        <div class="coupon-popup">
          <div class="coupon-popup-header">
            <h3>🎉 할인 쿠폰이 발급되었습니다!</h3>
            <p>내 쿠폰에서 확인하세요</p>
          </div>
          <div class="coupon-popup-content">
            <div class="coupon-preview">
              <div class="coupon-name">한성카페 아메리카노 1000원 할인 쿠폰</div>
              <div class="coupon-trail">${selectedTrail.name} 주변</div>
            </div>
          </div>
          <div class="coupon-popup-actions">
            <button class="btn btn-primary" onclick="window.location.href='/coupons'">
              🎫 내 쿠폰 보기
            </button>
            <button class="btn btn-secondary" onclick="this.closest('.coupon-popup-overlay').remove()">
              닫기
            </button>
          </div>
        </div>
      `
      
      document.body.appendChild(popup)
      
      // 3초 후 자동으로 커뮤니티로 이동
      setTimeout(() => {
        if (popup.parentNode) {
          popup.remove()
        }
        navigate('/community', { 
          state: { 
            trail: selectedTrail,
            fromAnalysis: true 
          } 
        })
      }, 3000)
    }
    
    showCouponPopup()
  }

  return (
    <div className="grid" style={{ marginTop: 16 }}>
      {analysis?.error && (
        <div className="card section" style={{ borderColor: '#4b1f28', background: 'rgba(255,78,113,0.08)' }}>
          <div className="section-title">문제가 발생했어요</div>
          <div style={{ color: '#ff7d95' }}>Gemini 오류: {analysis.message || analysis.error}</div>
        </div>
      )}

      {/* 상단 감정 표시 박스 */}
      <div className="card section">
        <div className="section-title">감정 분석</div>
        <div className="emotion-box">{emotion}</div>
        {keywords.length > 0 && (
          <div className="chips" style={{ marginTop: 12 }}>
            {keywords.map((k, i) => (
              <span key={i} className="chip">#{k}</span>
            ))}
          </div>
        )}
      </div>

      <Section title="공감의 한마디" icon>
        <div style={{ fontSize: 16, lineHeight: 1.7 }}>
          {analysis?.comfort_message || (analysis?.error ? '-' : '결과가 준비되는 대로 표시됩니다.')}
        </div>
      </Section>

      <Section title="추천 음악 3곡" icon>
        {recs.length === 0 ? (
          <div className="badge">{analysis?.error ? '-' : '추천 결과가 아직 없어요.'}</div>
        ) : (
          <div className="grid cols-3">
            {recs.map((r, idx) => (
              <div key={idx} className="music-card">
                <div className="music-title">{r?.artist} - {r?.title}</div>
                <div className="music-reason">{r?.reason}</div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {positiveUsed.length > 0 && (
        <Section title="안내" icon>
          <div style={{ fontSize: 15, lineHeight: 1.7 }}>
            {`"${positiveUsed.join('\", \"')}" 감정에 알맞은 산책로를 추천해드릴게요.`}
          </div>
        </Section>
      )}

      <Section title="추천 산책로" icon>
        {trail?.trails && trail.trails.length > 0 ? (
          <div className="trails-grid">
            {trail.trails.map((t, idx) => (
              <div key={idx} className="trail-card">
                <div className="trail-name">{t.name}</div>
                <div className="trail-address">{t.address}</div>
                {t.score && <div className="trail-score">추천 점수: {t.score}/10</div>}
                
                {/* 각 산책로마다 버튼들 */}
                <div style={{ marginTop: 12, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {/* 선택 버튼 (커뮤니티 입장) */}
                  <button
                    className="btn btn-primary"
                    onClick={() => handleSelectTrail(t)}
                    style={{ 
                      background: '#28a745', 
                      color: 'white',
                      border: 'none',
                      fontSize: '14px',
                      padding: '8px 16px',
                      flex: '1',
                      minWidth: '100px'
                    }}
                  >
                    ✅ 선택
                  </button>
                  
                  {/* 지도보기 버튼 */}
                  <button
                    className="btn btn-secondary"
                    onClick={() => setSelectedTrailForMap(t)}
                    style={{ 
                      background: '#4285f4', 
                      color: 'white',
                      border: 'none',
                      fontSize: '14px',
                      padding: '8px 16px',
                      flex: '1',
                      minWidth: '100px'
                    }}
                  >
                    🗺️ 지도보기
                  </button>
                </div>
              </div>
            ))}
            
            {/* 더 많은 산책로 보기 버튼은 별도로 표시 */}
            {trail.more && trail.more.length > 0 && (
              <div style={{ marginTop: 16, gridColumn: '1 / -1' }}>
                <Link
                  className="btn btn-primary"
                  to="/trails"
                  state={{ trails: trail.more, emotions: positiveUsed }}
                >
                  이 외의 산책로 보기
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="badge">추천 산책로가 없습니다.</div>
        )}
      </Section>

      {/* 개별 산책로 지도 모달 */}
      <TrailMap 
        trails={selectedTrailForMap ? [selectedTrailForMap] : []}
        isVisible={!!selectedTrailForMap}
        onClose={() => setSelectedTrailForMap(null)}
      />
    </div>
  )
}
