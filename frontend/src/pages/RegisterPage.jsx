import React, { useState } from 'react';
import { getIdToken } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import './RegisterPage.css';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    musicTaste: '',
    residence: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { signup, getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.username || 
        !formData.musicTaste || !formData.residence) {
      setError('모든 필드를 입력해주세요.');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return false;
    }

    if (formData.password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다. (Firebase 정책)');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // 1. Firebase Auth로 회원가입
      const user = await signup(formData.email, formData.password);
      console.log('Firebase Auth 회원가입 완료:', user.uid);

      // 2. 방금 생성된 사용자 객체에서 직접 ID 토큰 가져오기 (경쟁 상태 방지)
      const token = await getIdToken(user, true);
      const authHeaders = { Authorization: `Bearer ${token}` };
      console.log('Auth headers (direct):', authHeaders);

      const profileData = {
        username: formData.username,
        email: formData.email,
        music_taste: formData.musicTaste,
        residence: formData.residence
      };
      console.log('Profile data to send:', profileData);

      // 3. 백엔드에 프로필 정보 저장 (실패해도 로그인은 성공 상태 유지)
      try {
        const response = await apiService.register(profileData, authHeaders);
        console.log('Profile save success:', response);
        // 성공 상태 표시
        setSuccess(true);
        setError('');
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
      } catch (apiErr) {
        console.error('Profile save failed:', apiErr);
        console.error('API Error details:', {
          status: apiErr.response?.status,
          statusText: apiErr.response?.statusText,
          data: apiErr.response?.data,
          message: apiErr.message
        });
        
        // HTTP 상태 코드 확인
        if (apiErr.response?.status === 200 || apiErr.response?.status === 201) {
          // 실제로는 성공했지만 에러로 잘못 감지된 경우
          console.log('API call was actually successful');
          setSuccess(true);
          setError('');
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 2000);
        } else {
          // 실제 에러인 경우
          const errorMsg = apiErr.response?.data?.message || apiErr.message || '프로필 저장에 실패했습니다.';
          setError(`로그인은 완료되었습니다. 프로필 저장 실패: ${errorMsg}`);
        }
      }
    } catch (error) {
      console.error('Registration failed:', error);
      // Firebase Auth 에러 처리
      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            setError('이미 사용 중인 이메일입니다.');
            break;
          case 'auth/invalid-email':
            setError('유효하지 않은 이메일 주소입니다.');
            break;
          case 'auth/operation-not-allowed':
            setError('이메일/비밀번호 계정이 비활성화되어 있습니다.');
            break;
          case 'auth/weak-password':
            setError('비밀번호가 너무 약합니다.');
            break;
          default:
            setError('회원가입에 실패했습니다. 다시 시도해주세요.');
        }
      } else {
        const errorMessage = error.response?.data?.message || error.message || '회원가입에 실패했습니다.';
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <h1 className="register-title">회원가입</h1>
        <p className="register-subtitle">AI 음악 산책 메이트와 함께 시작해보세요</p>
        
        {/* 상단 안내는 제거하고 버튼 아래로 이동 */}
        
        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-group">
            <label htmlFor="email">이메일 *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="이메일을 입력해주세요"
              disabled={loading}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">비밀번호 *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="비밀번호를 입력해주세요 (6자 이상)"
              disabled={loading}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword">비밀번호 확인 *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="비밀번호를 다시 입력해주세요"
              disabled={loading}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="username">이름 *</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="이름을 입력해주세요"
              disabled={loading}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="musicTaste">음악 취향 *</label>
            <input
              type="text"
              id="musicTaste"
              name="musicTaste"
              value={formData.musicTaste}
              onChange={handleChange}
              placeholder="좋아하는 음악 장르나 아티스트를 입력해주세요"
              disabled={loading}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="residence">거주지 *</label>
            <input
              type="text"
              id="residence"
              name="residence"
              value={formData.residence}
              onChange={handleChange}
              placeholder="거주지를 입력해주세요 (예: 동대문구 회기동)"
              disabled={loading}
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="register-button"
            disabled={loading}
          >
            {loading ? '회원가입 중...' : '회원가입'}
          </button>
          {/* 버튼 바로 아래 메시지 표시 */}
          {error && <div className="error-message" style={{ marginTop: 12 }}>{error}</div>}
          {success && (
            <div className="success-message" style={{ marginTop: 12 }}>
              🎉 회원가입이 완료되었습니다!<br />
              잠시 후 홈페이지로 이동합니다...
            </div>
          )}
        </form>
        
        <div className="register-footer">
          <p>
            이미 계정이 있으신가요? 
            <Link to="/login" className="link">로그인</Link>
          </p>
          <Link to="/" className="link">홈으로 돌아가기</Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
