import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const menuItems = [
    {
      icon: '🏠',
      label: '홈',
      path: '/',
      show: true
    },
    {
      icon: '👤',
      label: currentUser ? '내 개인정보' : '로그인',
      path: currentUser ? '/profile' : '/login',
      show: true
    },
    {
      icon: '📝',
      label: '회원가입',
      path: '/register',
      show: !currentUser
    },
    {
      icon: '📋',
      label: '나의 이용내역',
      path: '/history',
      show: currentUser
    },
    {
      icon: '💬',
      label: '커뮤니티',
      path: '/community',
      show: currentUser,
      onClick: () => {
        // 커뮤니티 클릭 시 localStorage에 산책로 정보가 있는지 확인
        const lastSelectedTrail = localStorage.getItem('lastSelectedTrail')
        if (!lastSelectedTrail) {
          alert('산책로를 먼저 선택해주세요.\n\n산책로 추천 결과에서 "✅ 선택" 버튼을 클릭하면 해당 산책로의 커뮤니티에 입장할 수 있습니다.')
          return
        }
        navigate('/community')
      }
    },
    {
      icon: '🎫',
      label: '내 쿠폰',
      path: '/coupons',
      show: currentUser
    }
  ];

  const isActivePath = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="logo-text">Menu</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.filter(item => item.show).map((item) => (
          <button
            key={item.path}
            className={`sidebar-item ${isActivePath(item.path) ? 'active' : ''}`}
            onClick={() => {
              if (item.onClick) {
                item.onClick()
              } else {
                navigate(item.path)
              }
            }}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {currentUser && (
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-email">{currentUser.email}</div>
          </div>
          <button 
            className="logout-button"
            onClick={handleLogout}
          >
            <span className="sidebar-icon">🚪</span>
            <span className="sidebar-label">로그아웃</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
