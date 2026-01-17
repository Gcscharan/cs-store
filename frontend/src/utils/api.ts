import { getApiBaseUrl, toApiUrl } from "../config/runtime";

// Centralized API configuration
export const API_BASE_URL = getApiBaseUrl();

// Helper function to make API calls with proper base URL
export const apiCall = async (endpoint: string, options?: RequestInit) => {
  const url = toApiUrl(endpoint);
  return fetch(url, options);
};

// Helper function to get auth headers
export const getAuthHeaders = (token?: string) => ({
  'Content-Type': 'application/json',
  ...(token && { 'Authorization': `Bearer ${token}` })
});
