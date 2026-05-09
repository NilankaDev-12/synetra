import { useMutation, useQueryClient } from '@tanstack/react-query';
import { shareAPI } from '../services/api';
import { QUERY_KEYS } from '../utils/constants';
import toast from 'react-hot-toast';

// Share document with a new user OR update an existing user's permission.
// The backend share route already handles the "already shared" case by
// updating the permission, so the same endpoint serves both purposes.
export const useShareDocument = (documentId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) =>
      shareAPI.shareDocument(documentId, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DOCUMENT, documentId] });
      toast.success('Access updated');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to update access';
      toast.error(message);
    },
  });
};

// Convenience hook specifically for changing an existing user's permission.
// It delegates to useShareDocument so there is a single mutation path.
export const useUpdatePermission = (documentId) => {
  const shareDocument = useShareDocument(documentId);

  return {
    ...shareDocument,
    mutateAsync: ({ email, permission }) =>
      shareDocument.mutateAsync({ email, permission }),
  };
};

// Remove a user's access completely
export const useRemoveAccess = (documentId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId) => shareAPI.removeAccess(documentId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DOCUMENT, documentId] });
      toast.success('Access removed');
    },
    onError: () => {
      toast.error('Failed to remove access');
    },
  });
};