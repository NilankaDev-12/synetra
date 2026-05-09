import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authAPI } from '../services/api';
import { QUERY_KEYS } from '../utils/constants';
import { setToken as saveToken, removeToken, getToken } from '../utils/helpers';
import toast from 'react-hot-toast';

export const useAuthQuery = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.CURRENT_USER],
    queryFn: async () => {
      const token = getToken();
      if (!token) return null;
      
      try {
        const response = await authAPI.getCurrentUser();
        return response.data.user;
      } catch (error) {
        removeToken();
        return null;
      }
    },
    staleTime: Infinity,
    retry: false,
  });
};

export const useRegister = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userData) => authAPI.register(userData),
    onSuccess: (response) => {
      const { token, user } = response.data;
      saveToken(token);
      queryClient.setQueryData([QUERY_KEYS.CURRENT_USER], user);
      toast.success('Registration successful!');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
    },
  });
};

export const useLogin = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (credentials) => authAPI.login(credentials),
    onSuccess: (response) => {
      const { token, user } = response.data;
      saveToken(token);
      queryClient.setQueryData([QUERY_KEYS.CURRENT_USER], user);
      toast.success('Login successful!');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  
  return () => {
    removeToken();
    queryClient.setQueryData([QUERY_KEYS.CURRENT_USER], null);
    queryClient.clear();
    toast.success('Logged out successfully');
  };
};