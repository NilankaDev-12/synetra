import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentAPI } from '../services/api';
import { QUERY_KEYS } from '../utils/constants';
import toast from 'react-hot-toast';

// Get all documents
export const useDocuments = () => {
  return useQuery({
    queryKey: [QUERY_KEYS.DOCUMENTS],
    queryFn: async () => {
      const response = await documentAPI.getAll();
      return response.data.documents;
    },
  });
};

// Get single document
export const useDocument = (documentId) => {
  return useQuery({
    queryKey: [QUERY_KEYS.DOCUMENT, documentId],
    queryFn: async () => {
      const response = await documentAPI.getById(documentId);
      return response.data.document;
    },
    enabled: !!documentId,
    // Don't auto-refetch in background — the socket keeps content in sync.
    // Refetching races against in-flight saves and can overwrite unsaved edits.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: Infinity,
  });
};

// Create document
export const useCreateDocument = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => documentAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DOCUMENTS] });
      toast.success('Document created successfully');
    },
    onError: () => {
      toast.error('Failed to create document');
    },
  });
};

// Update document
export const useUpdateDocument = (documentId) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => documentAPI.update(documentId, data),
    onMutate: async (newData) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: [QUERY_KEYS.DOCUMENT, documentId] });

      const previousDocument = queryClient.getQueryData([QUERY_KEYS.DOCUMENT, documentId]);

      // Optimistically update the cache
      queryClient.setQueryData([QUERY_KEYS.DOCUMENT, documentId], (old) => ({
        ...old,
        ...newData,
      }));

      return { previousDocument };
    },
    onError: (err, newData, context) => {
      // Rollback on error
      queryClient.setQueryData(
        [QUERY_KEYS.DOCUMENT, documentId],
        context.previousDocument
      );
      toast.error('Failed to save document');
    },
    // NOTE: No invalidateQueries in onSettled — that would re-fetch from DB and
    // race against the debounced save, overwriting unsaved content. The socket
    // 'load-document' event is the canonical source of truth after a save.
  });
};

// Delete document
export const useDeleteDocument = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (documentId) => documentAPI.delete(documentId),
    onSuccess: (_, documentId) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DOCUMENTS] });
      queryClient.removeQueries({ queryKey: [QUERY_KEYS.DOCUMENT, documentId] });
      toast.success('Document deleted successfully');
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Failed to delete document';
      toast.error(message);
    },
  });
};