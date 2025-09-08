import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { db } from '../firebase/config'
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  orderBy, 
  query, 
  serverTimestamp,
  limit
} from 'firebase/firestore'
import BackButton from '../components/BackButton'
import './CommunityPage.css'

export default function CommunityPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  
  // location.state에서 trail 정보를 가져오거나, localStorage에서 마지막 선택한 산책로 정보를 가져옴
  const getTrailInfo = () => {
    // 1. location.state에서 직접 전달받은 trail 정보가 있으면 사용
    if (location.state?.trail) {
      return location.state.trail
    }
    
    // 2. localStorage에서 마지막으로 선택한 산책로 정보 가져오기
    try {
      const lastSelectedTrail = localStorage.getItem('lastSelectedTrail')
      if (lastSelectedTrail) {
        const parsed = JSON.parse(lastSelectedTrail)
        // 24시간 이내에 선택한 산책로인지 확인
        const selectedTime = new Date(parsed.timestamp)
        const now = new Date()
        const hoursDiff = (now - selectedTime) / (1000 * 60 * 60)
        
        if (hoursDiff <= 24) {
          return parsed.trail
        } else {
          // 24시간이 지났으면 localStorage에서 제거
          localStorage.removeItem('lastSelectedTrail')
        }
      }
    } catch (error) {
      console.error('localStorage에서 산책로 정보를 가져오는 중 오류:', error)
      localStorage.removeItem('lastSelectedTrail')
    }
    
    return null
  }
  
  const trail = getTrailInfo()
  
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [userProfile, setUserProfile] = useState(null)
  
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)

  // 로그인 체크
  useEffect(() => {
    if (!currentUser) {
      alert('로그인이 필요한 서비스입니다.')
      navigate('/login')
      return
    }

    if (!trail) {
      alert('산책로를 먼저 선택해주세요.\n\n산책로 추천 결과에서 "✅ 선택" 버튼을 클릭하면 해당 산책로의 커뮤니티에 입장할 수 있습니다.')
      navigate('/')
      return
    }

    // 사용자 프로필 가져오기
    fetchUserProfile()
  }, [currentUser, trail, navigate])

  // 사용자 프로필 조회
  const fetchUserProfile = async () => {
    if (!currentUser) return
    
    try {
      const response = await fetch('/api/me', {
        headers: {
          'Authorization': `Bearer ${await currentUser.getIdToken()}`
        }
      })
      
      if (response.ok) {
        const profile = await response.json()
        setUserProfile(profile)
      } else {
        // API 응답이 실패한 경우 기본 프로필 사용
        console.warn('프로필 API 응답 실패, 기본값 사용')
        setUserProfile({
          name: currentUser.displayName || currentUser.email?.split('@')[0] || '사용자',
          email: currentUser.email
        })
      }
    } catch (error) {
      console.error('프로필 조회 실패:', error)
      // 에러 발생 시 기본 프로필 사용
      setUserProfile({
        name: currentUser.displayName || currentUser.email?.split('@')[0] || '사용자',
        email: currentUser.email
      })
    }
  }

  // 실시간 메시지 구독
  useEffect(() => {
    if (!trail) return

    const communityId = `trail_${trail.name.replace(/\s+/g, '_')}`
    const messagesRef = collection(db, 'communities', communityId, 'messages')
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }))
      setMessages(newMessages)
      
      // 새 메시지가 있으면 스크롤 아래로
      setTimeout(() => {
        scrollToBottom()
      }, 100)
    })

    return () => unsubscribe()
  }, [trail])

  // 메시지 전송
  const sendMessage = async (e) => {
    e.preventDefault()
    
    if (!newMessage.trim() || !currentUser || !userProfile) return

    setIsLoading(true)
    
    try {
      const communityId = `trail_${trail.name.replace(/\s+/g, '_')}`
      const messagesRef = collection(db, 'communities', communityId, 'messages')
      
      await addDoc(messagesRef, {
        text: newMessage.trim(),
        userId: currentUser.uid,
        userName: userProfile.name || '익명',
        userEmail: currentUser.email,
        timestamp: serverTimestamp(),
        trailName: trail.name
      })
      
      setNewMessage('')
    } catch (error) {
      console.error('메시지 전송 실패:', error)
      alert('메시지 전송에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 스크롤 아래로
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // 시간 포맷팅
  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    
    const now = new Date()
    const messageTime = new Date(timestamp)
    const diffInMinutes = Math.floor((now - messageTime) / (1000 * 60))
    
    if (diffInMinutes < 1) return '방금 전'
    if (diffInMinutes < 60) return `${diffInMinutes}분 전`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}시간 전`
    
    return messageTime.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!trail) {
    return (
      <div className="community-page">
        <div className="error-message">
          산책로 정보를 찾을 수 없습니다.
        </div>
      </div>
    )
  }

  return (
    <div className="community-page">
      <header className="community-header">
        <div className="header-content">
          <div>
            <h1 className="community-title">🚶‍♂️ {trail.name} 커뮤니티</h1>
            <p className="community-subtitle">{trail.address}</p>
          </div>
          <BackButton />
        </div>
      </header>

      <div className="community-body">
        <div className="messages-container" ref={messagesContainerRef}>
          {messages.length === 0 ? (
            <div className="empty-messages">
              <p>🎉 첫 번째 메시지를 남겨보세요!</p>
              <p>이 산책로를 선택한 사람들과 자유롭게 대화해보세요.</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isMyMessage = message.userId === currentUser?.uid
              const showUserName = index === 0 || messages[index - 1]?.userId !== message.userId
              
              return (
                <div 
                  key={message.id} 
                  className={`message ${isMyMessage ? 'my-message' : 'other-message'}`}
                >
                  {!isMyMessage && showUserName && (
                    <div className="message-user">{message.userName}</div>
                  )}
                  <div className="message-content">
                    <div className="message-text">{message.text}</div>
                    <div className="message-time">{formatTime(message.timestamp)}</div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} className="message-form">
          <div className="message-input-container">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="메시지를 입력하세요..."
              className="message-input"
              disabled={isLoading}
              maxLength={500}
            />
            <button 
              type="submit" 
              className="send-button"
              disabled={isLoading || !newMessage.trim()}
            >
              {isLoading ? '전송 중...' : '전송'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
