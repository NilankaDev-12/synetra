import { useState } from 'react';
import { useMutation, gql } from '@apollo/client';
import Button from '../common/Button';
import toast from 'react-hot-toast';

const CREATE_COMMENT = gql`
  mutation CreateComment($documentId: ID!, $content: String!, $parentCommentId: ID) {
    createComment(documentId: $documentId, content: $content, parentCommentId: $parentCommentId) {
      id
      content
      author {
        id
        name
      }
      createdAt
    }
  }
`;

const CommentForm = ({ documentId, parentCommentId = null, onCommentAdded, onCancel }) => {
  const [content, setContent] = useState('');
  const [createComment, { loading }] = useMutation(CREATE_COMMENT);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!content.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }

    try {
      await createComment({
        variables: {
          documentId,
          content: content.trim(),
          parentCommentId
        }
      });

      setContent('');
      toast.success('Comment added successfully');
      
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (error) {
      console.error('Create comment error:', error);
      toast.error('Failed to add comment');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={parentCommentId ? 'Write a reply...' : 'Add a comment...'}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none transition-colors"
        rows="3"
      />
      
      <div className="flex justify-end space-x-2">
        {onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            variant="secondary"
            className="text-sm"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={loading || !content.trim()}
          className="text-sm"
        >
          {loading ? 'Posting...' : parentCommentId ? 'Reply' : 'Comment'}
        </Button>
      </div>
    </form>
  );
};

export default CommentForm;