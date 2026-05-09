import { formatDistanceToNow } from 'date-fns';

export const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const formatDate = (date) => {
  if (!date) return '';
  const parsed = new Date(isNaN(date) ? date : Number(date));
  if (isNaN(parsed.getTime())) return '';
  return formatDistanceToNow(parsed, { addSuffix: true });
};

export const truncateText = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const getToken = () => localStorage.getItem('token');
export const setToken = (token) => localStorage.setItem('token', token);
export const removeToken = () => localStorage.removeItem('token');

// Identical timing logic to the original — only adds .cancel() for DocumentHeader
export const debounce = (func, wait) => {
  let timeout;
  function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  }
  executedFunction.cancel = () => clearTimeout(timeout);
  return executedFunction;
};