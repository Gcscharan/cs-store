// Centralized API configuration
export const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend-domain.com/api'  // Replace with actual production URL
  : 'http://localhost:5001/api';

// Helper function to make API calls with proper base URL
export const apiCall = async (endpoint: string, options?: RequestInit) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  return fetch(url, options);
};

// Helper function to get auth headers
export const getAuthHeaders = (token?: string) => ({
  'Content-Type': 'application/json',
  ...(token && { 'Authorization': `Bearer ${token}` })
});
