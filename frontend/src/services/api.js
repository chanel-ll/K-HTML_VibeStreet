import axios from 'axios';

const API_BASE = ''; // Vite proxy 사용

// Axios 인스턴스 생성
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// API 서비스 함수들
export const apiService = {
  // 회원가입 시 프로필 정보 저장
  register: async (userData, authHeaders) => {
    const response = await api.post('/api/register', userData, {
      headers: authHeaders
    });
    return response.data;
  },

  // 내 정보 조회
  getMyInfo: async (authHeaders) => {
    const response = await api.get('/api/me', {
      headers: authHeaders
    });
    return response.data;
  },

  // 내 정보 수정
  updateMyInfo: async (userData, authHeaders) => {
    const response = await api.put('/api/me', userData, {
      headers: authHeaders
    });
    return response.data;
  },

  // AI 분석 (인증 필요, 위치 정보 포함)
  analyze: async (data, authHeaders) => {
    // data가 객체인지 문자열인지 확인하여 처리
    const requestData = typeof data === 'string' ? { text: data } : data;
    
    const response = await api.post('/api/analyze', requestData, {
      headers: authHeaders
    });
    return response.data;
  },

  // 나의 이용 내역 조회
  getHistory: async (authHeaders) => {
    const response = await api.get('/api/history', {
      headers: authHeaders
    });
    return response.data;
  },

  // 특정 이용 내역 삭제
  deleteHistory: async (historyId, authHeaders) => {
    const response = await api.delete(`/api/history/${historyId}`, {
      headers: authHeaders
    });
    return response.data;
  }
};

export default apiService;
