import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import BackButton from '../components/BackButton'
import './CouponsPage.css'

export default function CouponsPage() {
  const { currentUser } = useAuth()
  const [coupons, setCoupons] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (currentUser) {
      // 실제로는 Firebase에서 사용자의 쿠폰을 가져와야 함
      // 지금은 임시 데이터로 표시
      loadUserCoupons()
    }
  }, [currentUser])

  const loadUserCoupons = () => {
    setIsLoading(true)
    
    // 임시 쿠폰 데이터 (실제로는 Firebase에서 가져옴)
    const tempCoupons = [
      {
        id: 'coupon_001',
        name: '한성카페 아메리카노 1000원 할인 쿠폰',
        description: '아메리카노 구매 시 1000원 할인',
        discount: '1000원',
        category: '카페',
        validUntil: '2024-12-31',
        isUsed: false,
        trailName: '장이소공원',
        issuedAt: '2024-01-15'
      },
      {
        id: 'coupon_002',
        name: '맛있는 식당 점심 메뉴 2000원 할인',
        description: '점심 메뉴 주문 시 2000원 할인',
        discount: '2000원',
        category: '식당',
        validUntil: '2024-12-31',
        isUsed: false,
        trailName: '장이소공원',
        issuedAt: '2024-01-15'
      }
    ]
    
    setTimeout(() => {
      setCoupons(tempCoupons)
      setIsLoading(false)
    }, 1000)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getCategoryIcon = (category) => {
    switch (category) {
      case '카페':
        return '☕'
      case '식당':
        return '🍽️'
      case '편의점':
        return '🏪'
      default:
        return '🎫'
    }
  }

  const getStatusBadge = (isUsed) => {
    if (isUsed) {
      return <span className="status-badge used">사용완료</span>
    }
    return <span className="status-badge active">사용가능</span>
  }

  if (!currentUser) {
    return (
      <div className="coupons-page">
        <div className="error-message">
          로그인이 필요한 서비스입니다.
        </div>
      </div>
    )
  }

  return (
    <div className="coupons-page">
      <header className="coupons-header">
        <div className="header-content">
          <div>
            <h1 className="coupons-title">🎫 내 쿠폰</h1>
            <p className="coupons-subtitle">발급받은 할인 쿠폰을 확인하세요</p>
          </div>
          <BackButton />
        </div>
      </header>

      <div className="coupons-body">
        {isLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>쿠폰을 불러오는 중...</p>
          </div>
        ) : coupons.length === 0 ? (
          <div className="empty-coupons">
            <div className="empty-icon">🎫</div>
            <h3>아직 발급된 쿠폰이 없습니다</h3>
            <p>산책로를 선택하면 주변 식당/카페 할인 쿠폰을 받을 수 있어요!</p>
            <button 
              className="btn btn-primary"
              onClick={() => window.history.back()}
            >
              산책로 선택하러 가기
            </button>
          </div>
        ) : (
          <div className="coupons-grid">
            {coupons.map((coupon) => (
              <div key={coupon.id} className={`coupon-card ${coupon.isUsed ? 'used' : ''}`}>
                <div className="coupon-header">
                  <div className="coupon-category">
                    {getCategoryIcon(coupon.category)} {coupon.category}
                  </div>
                  {getStatusBadge(coupon.isUsed)}
                </div>
                
                <div className="coupon-content">
                  <h3 className="coupon-name">{coupon.name}</h3>
                  <p className="coupon-description">{coupon.description}</p>
                  
                  <div className="coupon-details">
                    <div className="coupon-discount">
                      <span className="discount-label">할인 금액</span>
                      <span className="discount-amount">{coupon.discount}</span>
                    </div>
                    
                    <div className="coupon-trail">
                      <span className="trail-label">발급 산책로</span>
                      <span className="trail-name">{coupon.trailName}</span>
                    </div>
                  </div>
                </div>
                
                <div className="coupon-footer">
                  <div className="coupon-dates">
                    <div className="issued-date">
                      <span>발급일: {formatDate(coupon.issuedAt)}</span>
                    </div>
                    <div className="valid-until">
                      <span>유효기간: {formatDate(coupon.validUntil)}</span>
                    </div>
                  </div>
                  
                  {!coupon.isUsed && (
                    <button className="btn btn-primary use-coupon-btn">
                      쿠폰 사용하기
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
