import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { authApi } from '../services/authApi';
import type { User, UpdateProfileData } from '../types/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string, remember: boolean) => Promise<User>;
  register: (username: string, email: string, password: string, role: string) => Promise<User>;
  updateUser: (data: UpdateProfileData) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (savedToken) {
      setToken(savedToken);
      authApi.getMe(savedToken)
        .then((userData) => setUser(userData))
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string, remember: boolean): Promise<User> => {
    const response = await authApi.login({ username, password });
    const newToken = response.access_token;

    if (remember) {
      localStorage.setItem(TOKEN_KEY, newToken);
    }

    setToken(newToken);
    const userData = await authApi.getMe(newToken);
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (username: string, email: string, password: string, role: string): Promise<User> => {
    await authApi.register({ username, email, password, role });
    const response = await authApi.login({ username, password });
    const newToken = response.access_token;

    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    const userData = await authApi.getMe(newToken);
    setUser(userData);
    return userData;
  }, []);

  const updateUser = useCallback(async (data: UpdateProfileData) => {
    if (!token) throw new Error('Not authenticated');
    const updatedUser = await authApi.updateProfile(token, data);
    setUser(updatedUser);
  }, [token]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}