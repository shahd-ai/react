import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type':               'application/json',
    'bypass-tunnel-reminder':     'true',
    'ngrok-skip-browser-warning': 'true',
  },
});

// ── Injecter le token automatiquement dans chaque requête ─────────────────────
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const register = async ({ nom, prenom, email, password }) => {
  const res = await api.post('/auth/register', { nom, prenom, email, password });
  return res.data;
};

export const login = async ({ email, password }) => {
  const res = await api.post('/auth/login', { email, password });
  return res.data;
};

export const getMe = async () => {
  const res = await api.get('/auth/me');
  return res.data;
};

export const logout = async () => {
  await AsyncStorage.removeItem('auth_token');
  await AsyncStorage.removeItem('auth_user');
};

// ── Existing routes ───────────────────────────────────────────────────────────
export const getCultures = async () => {
  const res = await api.get('/cultures');
  return res.data.cultures;
};

export const predict = async (data) => {
  const res = await api.post('/predict', data);
  return res.data;
};

export const predictFertilizer = async (data) => {
  const res = await api.post('/fertilizer/predict', data);
  return res.data;
};

export const chat = async (messages) => {
  const res = await api.post('/chat', { messages });
  return res.data.response;
};

export default api;