import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('binhaz_token');
    const savedUser = localStorage.getItem('binhaz_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  function login(tokenVal, userData) {
    localStorage.setItem('binhaz_token', tokenVal);
    localStorage.setItem('binhaz_user', JSON.stringify(userData));
    setToken(tokenVal);
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('binhaz_token');
    localStorage.removeItem('binhaz_user');
    setToken(null);
    setUser(null);
  }

  function updateUser(updates) {
    const updated = { ...user, ...updates };
    localStorage.setItem('binhaz_user', JSON.stringify(updated));
    setUser(updated);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
