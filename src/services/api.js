import axios from 'axios'
import toast from 'react-hot-toast'

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Error throttling to prevent toast spam
const errorThrottle = new Map()

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    const message = error.response?.data?.message || error.message || 'An error occurred'
    
    // Handle authentication errors
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('userData')
      window.location.href = '/login'
      return Promise.reject(error)
    }
    
    // Don't show toast for validation errors or transcription 404s (normal for new meetings)
    const shouldShowToast = error.response?.status !== 422 && 
                          !(error.response?.status === 404 && error.config?.url?.includes('/transcriptions/meeting/'))
    
    if (shouldShowToast) {
      // Throttle identical error messages to prevent spam
      const errorKey = `${error.response?.status || 'network'}-${error.config?.url || 'unknown'}`
      const now = Date.now()
      const lastShown = errorThrottle.get(errorKey)
      
      if (!lastShown || now - lastShown > 5000) { // Show same error max once per 5 seconds
        toast.error(message)
        errorThrottle.set(errorKey, now)
      }
    }
    
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  getCurrentUser: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  changePassword: (currentPassword, newPassword) => 
    api.put('/auth/change-password', { currentPassword, newPassword })
}

// Users API
export const usersAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (profileData) => api.put('/users/profile', profileData),
  updateSettings: (settings) => api.put('/users/settings', settings),
  getDashboardStats: () => api.get('/users/dashboard'),
  uploadAvatar: (avatarUrl) => api.post('/users/avatar', { avatarUrl }),
  deleteAccount: (password) => api.delete('/users/account', { data: { password } }),
  exportData: () => api.get('/users/export'),
  searchUsers: (query) => api.get('/users/search', { params: { q: query } })
}

// Meetings API
export const meetingsAPI = {
  getMeetings: (params = {}) => api.get('/meetings', { params }),
  getMeeting: (id) => api.get(`/meetings/${id}`),
  createMeeting: (meetingData) => api.post('/meetings', meetingData),
  updateMeeting: (id, meetingData) => api.put(`/meetings/${id}`, meetingData),
  deleteMeeting: (id) => api.delete(`/meetings/${id}`),
  startMeeting: (id) => api.post(`/meetings/${id}/start`),
  endMeeting: (id) => api.post(`/meetings/${id}/end`),
  joinMeeting: (id) => api.post(`/meetings/${id}/join`),
  leaveMeeting: (id) => api.post(`/meetings/${id}/leave`),
  getMeetingByRoomId: (roomId) => api.get(`/meetings/room/${roomId}`),
  getMeetingAnalytics: (id) => api.get(`/meetings/${id}/analytics`)
}

// Transcriptions API
export const transcriptionsAPI = {
  getTranscription: (meetingId) => api.get(`/transcriptions/meeting/${meetingId}`),
  getChatMessages: (meetingId, params = {}) => 
    api.get(`/transcriptions/meeting/${meetingId}/chat`, { params }),
  addSegment: (meetingId, segmentData) => 
    api.post(`/transcriptions/meeting/${meetingId}/segments`, segmentData),
  searchSegments: (meetingId, params) => 
    api.get(`/transcriptions/meeting/${meetingId}/search`, { params }),
  updateSegment: (segmentId, updates) => api.put(`/transcriptions/segments/${segmentId}`, updates),
  deleteSegment: (segmentId) => api.delete(`/transcriptions/segments/${segmentId}`),
  exportTranscription: (meetingId, format = 'txt') => 
    api.get(`/transcriptions/meeting/${meetingId}/export`, { 
      params: { format },
      responseType: 'blob'
    })
}

// AI API
export const aiAPI = {
  transcribeAudio: (meetingId, audioData, speaker = null) => 
    api.post('/ai/transcribe', { meetingId, audioData, speaker }),
  askQuestion: (meetingId, question) => 
    api.post('/ai/ask', { meetingId, question }),
  generateSummary: (meetingId) => api.post(`/ai/summarize/${meetingId}`),
  getInsights: (meetingId) => api.get(`/ai/insights/${meetingId}`)
}

// Health check
export const healthAPI = {
  check: () => axios.get(`${import.meta.env.VITE_BACKEND_URL?.replace('/api', '') || 'http://localhost:5000'}/health`)
}

export default api
