import { createContext, useContext } from 'react';
import { useAuthQuery, useRegister, useLogin, useLogout } from '../hooks/useAuth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const { data: user, isLoading: loading } = useAuthQuery();
  const registerMutation = useRegister();
  const loginMutation = useLogin();
  const logout = useLogout();

  const register = async (userData) => {
    try {
      await registerMutation.mutateAsync(userData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const login = async (credentials) => {
    try {
      await loginMutation.mutateAsync(credentials);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    loading,
    register,
    login,
    logout,
    isAuthenticated: !!user,
    isRegistering: registerMutation.isPending,
    isLoggingIn: loginMutation.isPending,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};