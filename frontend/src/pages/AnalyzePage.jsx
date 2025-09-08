import React from 'react'
import ResultsDisplay from '../components/ResultsDisplay'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLocation as useLocationContext } from '../context/LocationContext'
import BackButton from '../components/BackButton'

export default function AnalyzePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const result = location.state?.result || null
  const { currentAddress, isGettingLocation } = useLocationContext()

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="title">AI 음악 산책 메이트</h1>
          <p className="subtitle">분석 결과</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          {/* 현재 위치 주소 표시 */}
          {currentAddress && (
            <div className="glass-badge" style={{ 
              fontSize: 14, 
              fontWeight: 500, 
              color: '#a8b2d1',
              opacity: isGettingLocation ? 0.7 : 1 
            }}>
              📍 {currentAddress}
            </div>
          )}
          <BackButton />
        </div>
      </header>

      {!result && (
        <div className="card section" style={{ marginBottom: 16 }}>
          결과 데이터가 없습니다. 처음 화면으로 돌아가 다시 시도해주세요.
        </div>
      )}

      <ResultsDisplay result={result} />

      <div className="card section" style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={() => navigate('/')}>다시 추천받기</button>
      </div>
    </div>
  )
}
