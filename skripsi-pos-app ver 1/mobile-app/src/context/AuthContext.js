import React, { createContext, useContext, useState } from 'react';
import { setAuthToken } from '../api/client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setAuthToken(authToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setAuthToken(null);
  };

  const updateUser = (nextUser) => {
    setUser(nextUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}