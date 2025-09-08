import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'

export default function TrailsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const trails = location.state?.trails || []
  const emotions = location.state?.emotions || []

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="title">이 외의 산책로</h1>
          <p className="subtitle">점수가 높은 순으로 최대 10개를 보여드립니다.</p>
        </div>
        <BackButton />
      </header>

      {emotions.length > 0 && (
        <div className="card section" style={{ marginBottom: 12 }}>
          <div className="section-title">선택된 긍정 감정</div>
          <div className="chips">
            {emotions.map((e, i) => (
              <span className="chip" key={i}>#{e}</span>
            ))}
          </div>
        </div>
      )}

      <div className="card section">
        {trails.length === 0 ? (
          <div className="badge">추가 산책로가 없습니다.</div>
        ) : (
          <div className="grid" style={{ gap: 10 }}>
            {trails.map((t, idx) => (
              <div key={idx} className="trail-card">
                <div className="trail-name">{t.name}</div>
                <div className="trail-address">{t.address}</div>
                {t.score && <div className="trail-score">추천 점수: {t.score}/10</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


