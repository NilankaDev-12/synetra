export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
export const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:5000/graphql';

export const PERMISSIONS = {
  VIEW: 'view',
  EDIT: 'edit'
};

export const DEBOUNCE_SAVE_DELAY = 1000; // 1 second

export const QUERY_KEYS = {
  CURRENT_USER: 'currentUser',
  DOCUMENTS: 'documents',
  DOCUMENT: 'document',
};