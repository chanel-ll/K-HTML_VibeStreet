import React, { useState, useEffect } from 'react'
import InputForm from './components/InputForm'
import ResultsDisplay from './components/ResultsDisplay'
import WalkIllustration from './components/WalkIllustration'
import Sidebar from './components/Sidebar'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useLocation } from './context/LocationContext'

import { apiService } from './services/api'

const API_BASE = '' // use Vite proxy for /api
const CLIENT_TIMEOUT_MS = 300000 // 5분

export default function App() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [done, setDone] = useState(false)
  const [todayStr, setTodayStr] = useState('')
  const navigate = useNavigate()
  const { currentUser, getAuthHeaders } = useAuth()
  const { requestGPSLocation, currentAddress, currentLocation, isGettingLocation } = useLocation()


  useEffect(() => {
    const computeTodayKst = () => {
      const now = new Date()
      const parts = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'long',
      }).formatToParts(now)
      const get = (t) => parts.find(p => p.type === t)?.value || ''
      const yyyy = get('year')
      const mm = get('month')
      const dd = get('day')
      const wk = get('weekday')
      setTodayStr(`${yyyy}.${mm}.${dd} ${wk}`)
    }
    computeTodayKst()
    const id = setInterval(computeTodayKst, 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // 페이지 로드 시 위치 정보 자동 요청
  useEffect(() => {
    if (!currentLocation && currentUser) {
      // 로그인된 사용자의 경우에만 자동으로 위치 요청
      const timer = setTimeout(() => {
        requestGPSLocation().catch((error) => {
          console.log('[App] 초기 위치 요청 실패 (사용자가 거부했을 수 있음):', error.message)
        })
      }, 1000) // 1초 후 실행 (카카오맵 로드 대기)
      
      return () => clearTimeout(timer)
    }
  }, [currentUser, currentLocation, requestGPSLocation])



    const onSubmit = async () => {
    setError('')
    setResult(null)
    setDone(false)
    
    if (!text.trim()) {
      setError('내용을 입력해주세요.')
      return
    }

    // 로그인 확인
    if (!currentUser) {
      setError('로그인이 필요한 서비스입니다. 로그인 후 이용해주세요.')
      return
    }

    try {
      setLoading(true)
      
      // 카카오맵 GPS 위치 정보 요청 (팝업으로 권한 요청)
      let userLocation = currentLocation
      if (!userLocation) {
        try {
          console.log('[App] 카카오맵 GPS 위치 정보 요청 시작')
          userLocation = await requestGPSLocation()
          console.log('[App] GPS 위치 정보 획득 성공:', userLocation)
        } catch (locationErr) {
          console.warn('[App] 위치 정보 획득 실패, 기본 추천으로 진행:', locationErr.message)
          // 위치 정보 없이도 계속 진행
        }
      }

      // AI 분석 요청 (위치 정보 포함)
      const authHeaders = await getAuthHeaders()
      const analysisData = {
        text,
        location: userLocation || null  // 위치 정보가 있으면 함께 전송
      }
      
      const data = await apiService.analyze(analysisData, authHeaders)
      setResult(data)
      setDone(true)
    } catch (e) {
      console.error('Analysis failed:', e)
      if (e.response?.status === 401) {
        setError('로그인 세션이 만료되었습니다. 다시 로그인해주세요.')
      } else {
        const errorMessage = e.response?.data?.message || e.message || '요청에 실패했습니다.'
        setError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const goAnalyze = () => {
    if (result) navigate('/analyze', { state: { result } })
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="main-content">
        <header className="header">
          <div>
            <h1 className="title">AI 음악 산책 메이트</h1>
            <p className="subtitle">당신의 하루에 어울리는 음악과 산책로를 전해드려요</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            {todayStr && (
              <div className="glass-badge date-badge" style={{ marginBottom: 0, fontSize: 17, fontWeight: 700 }}>
                {todayStr}
              </div>
            )}
            {/* 현재 위치 주소 표시 (카카오맵 기반) */}
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

          </div>
        </header>

        {!currentUser && (
          <div className="login-notice">
            <p>🎵 개인 맞춤 추천을 받으시려면 로그인이 필요합니다</p>
            <p>회원가입 시 음악 취향을 등록하면 더욱 정확한 추천을 받을 수 있어요!</p>
          </div>
        )}

        <InputForm value={text} onChange={setText} onSubmit={onSubmit} loading={loading} />
        <WalkIllustration />

        {error && <div className="card section" style={{ borderColor: '#3a2a2a', marginTop: 14 }}>{error}</div>}

        {done && (
          <div className="card section" style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span>분석이 완료되었어요. 결과 페이지로 이동하시겠어요?</span>
            <button className="btn btn-primary" onClick={goAnalyze}>결과 보러가기</button>
          </div>
        )}

        {/* 초기 화면에서는 결과를 이 페이지에 렌더링하지 않음. */}
        {/* <ResultsDisplay result={result} /> */}
      </div>
    </div>
  )
}
