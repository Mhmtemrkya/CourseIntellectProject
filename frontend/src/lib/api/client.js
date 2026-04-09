// CourseIntellect API Client - Axios wrapper with interceptors
import axios from 'axios';
import { useAuthStore } from '../../store/authStore';

// Create axios instance
const apiClient = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor - Add token and baseUrl
apiClient.interceptors.request.use(
  (config) => {
    const { token, baseUrl } = useAuthStore.getState();
    
    // Set base URL dynamically
    config.baseURL = baseUrl;
    
    // Add Authorization header
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle 401 and refresh token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const { refreshAccessToken, logout } = useAuthStore.getState();
      const refreshed = await refreshAccessToken();
      
      if (refreshed) {
        // Retry with new token
        const { token } = useAuthStore.getState();
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      } else {
        // Redirect to login
        logout();
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;

// Generic API methods
export const api = {
  get: (url, config) => apiClient.get(url, config),
  post: (url, data, config) => apiClient.post(url, data, config),
  put: (url, data, config) => apiClient.put(url, data, config),
  patch: (url, data, config) => apiClient.patch(url, data, config),
  delete: (url, config) => apiClient.delete(url, config),
};
