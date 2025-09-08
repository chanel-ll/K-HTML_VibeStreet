import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import './ProfilePage.css';
import BackButton from '../components/BackButton';

const ProfilePage = () => {
  const [userInfo, setUserInfo] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    username: '',
    musicTaste: '',
    residence: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const { getAuthHeaders, logout } = useAuth();

  // 사용자 정보 조회
  const fetchUserInfo = async () => {
    try {
      setLoading(true);
      setError('');
      const authHeaders = await getAuthHeaders();
      const response = await apiService.getMyInfo(authHeaders);
      setUserInfo(response.user);
      setEditData({
        username: response.user.username || '',
        musicTaste: response.user.music_taste || '',
        residence: response.user.residence || ''
      });
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      setError('사용자 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!editData.username.trim() || !editData.musicTaste.trim() || !editData.residence.trim()) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    try {
      setSaving(true);
      const authHeaders = await getAuthHeaders();
      const updateData = {
        username: editData.username.trim(),
        music_taste: editData.musicTaste.trim(),
        residence: editData.residence.trim()
      };

      await apiService.updateMyInfo(updateData, authHeaders);
      
      // 업데이트된 정보 다시 가져오기
      await fetchUserInfo();
      setEditMode(false);
      setSuccessMessage('프로필이 성공적으로 업데이트되었습니다.');
      
      // 성공 메시지 3초 후 자동 삭제
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (error) {
      console.error('Failed to update profile:', error);
      const errorMessage = error.response?.data?.message || '프로필 업데이트에 실패했습니다.';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setError('');
    setSuccessMessage('');
    // 원래 데이터로 복원
    if (userInfo) {
      setEditData({
        username: userInfo.username || '',
        musicTaste: userInfo.music_taste || '',
        residence: userInfo.residence || ''
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <h1 className="profile-title">내 개인정보</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <BackButton label="이전 페이지" />
            <button 
              className="logout-button"
              onClick={handleLogout}
            >
              로그아웃
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}

        {!editMode ? (
          // 조회 모드
          <div className="profile-info">
            <div className="info-group">
              <label>이메일</label>
              <div className="info-value">{userInfo?.email || '정보 없음'}</div>
            </div>
            
            <div className="info-group">
              <label>이름</label>
              <div className="info-value">{userInfo?.username || '정보 없음'}</div>
            </div>
            
            <div className="info-group">
              <label>음악 취향</label>
              <div className="info-value">{userInfo?.music_taste || '정보 없음'}</div>
            </div>
            
            <div className="info-group">
              <label>거주지</label>
              <div className="info-value">{userInfo?.residence || '정보 없음'}</div>
            </div>
            


            <button 
              className="edit-button"
              onClick={() => setEditMode(true)}
            >
              개인정보 수정
            </button>
          </div>
        ) : (
          // 수정 모드
          <form onSubmit={handleEditSubmit} className="edit-form">
            <div className="form-group">
              <label htmlFor="username">이름 *</label>
              <input
                type="text"
                id="username"
                name="username"
                value={editData.username}
                onChange={handleEditChange}
                disabled={saving}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="musicTaste">음악 취향 *</label>
              <input
                type="text"
                id="musicTaste"
                name="musicTaste"
                value={editData.musicTaste}
                onChange={handleEditChange}
                disabled={saving}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="residence">거주지 *</label>
              <input
                type="text"
                id="residence"
                name="residence"
                value={editData.residence}
                onChange={handleEditChange}
                disabled={saving}
                required
              />
            </div>

            <div className="form-actions">
              <button 
                type="button"
                className="cancel-button"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                취소
              </button>
              <button 
                type="submit"
                className="save-button"
                disabled={saving}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
