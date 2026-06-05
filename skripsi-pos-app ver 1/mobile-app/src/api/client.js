import axios from 'axios';

export const api = axios.create({
  baseURL: 'https://skripsi-pos-app-production.up.railway.app/api',
  timeout: 10000,
});

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};