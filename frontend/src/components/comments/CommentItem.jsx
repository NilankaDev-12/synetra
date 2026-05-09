import { useState } from 'react';
import { useMutation, gql } from '@apollo/client';
import { 
  TrashIcon, 
  PencilIcon,
  ChatBubbleLeftIcon 
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { formatDate, getInitials } from '../../utils/helpers';
import CommentForm from './CommentForm';
import Button from '../common/Button';
import toast from 'react-hot-toast';

const UPDATE_COMMENT = gql`
  mutation UpdateComment($commentId: ID!, $content: String!) {
    updateComment(commentId: $commentId, content: $content) {
      id
      content
      updatedAt
    }
  }
`;

const DELETE_COMMENT = gql`
  mutation DeleteComment($commentId: ID!) {
    deleteComment(commentId: $commentId)
  }
`;

const CommentItem = ({ comment, documentId, onUpdate, level = 0 }) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showReplies, setShowReplies] = useState(true);

  const [updateComment, { loading: updating }] = useMutation(UPDATE_COMMENT);
  const [deleteComment, { loading: deleting }] = useMutation(DELETE_COMMENT);

  const isAuthor = user?.id === comment.author.id;

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    if (!editContent.trim()) {
      toast.error('Comment cannot be empty');
      return;
    }

    try {
      await updateComment({
        variables: {
          commentId: comment.id,
          content: editContent.trim()
        }
      });

      setIsEditing(false);
      toast.success('Comment updated successfully');
      onUpdate();
    } catch (error) {
      console.error('Update comment error:', error);
      toast.error('Failed to update comment');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      await deleteComment({
        variables: {
          commentId: comment.id
        }
      });

      toast.success('Comment deleted successfully');
      onUpdate();
    } catch (error) {
      console.error('Delete comment error:', error);
      toast.error('Failed to delete comment');
    }
  };

  const marginLeft = level > 0 ? `ml-${Math.min(level * 4, 8)}` : '';

  return (
    <div className={`${marginLeft}`}>
      <div className="bg-gray-50 rounded-lg p-3 mb-2">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-semibold">
              {getInitials(comment.author.name)}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {comment.author.name}
              </p>
              <p className="text-xs text-gray-500">
                {formatDate(comment.createdAt)}
              </p>
            </div>
          </div>

          {isAuthor && !isEditing && (
            <div className="flex space-x-1">
              <button
                onClick={() => setIsEditing(true)}
                className="text-gray-400 hover:text-primary-600 transition-colors"
                title="Edit"
              >
                <PencilIcon className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                title="Delete"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleUpdate} className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500 transition-colors"
              rows="2"
            />
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(comment.content);
                }}
                variant="secondary"
                className="text-xs px-2 py-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updating}
                className="text-xs px-2 py-1"
              >
                {updating ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {comment.content}
          </p>
        )}

        {!isEditing && (
          <div className="mt-2 flex items-center space-x-3">
            <button
              onClick={() => setIsReplying(!isReplying)}
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center space-x-1 transition-colors"
            >
              <ChatBubbleLeftIcon className="w-4 h-4" />
              <span>Reply</span>
            </button>

            {comment.replies && comment.replies.length > 0 && (
              <button
                onClick={() => setShowReplies(!showReplies)}
                className="text-xs text-gray-600 hover:text-gray-700 transition-colors"
              >
                {showReplies ? 'Hide' : 'Show'} {comment.replies.length}{' '}
                {comment.replies.length === 1 ? 'reply' : 'replies'}
              </button>
            )}
          </div>
        )}
      </div>

      {isReplying && (
        <div className="ml-4 mb-2">
          <CommentForm
            documentId={documentId}
            parentCommentId={comment.id}
            onCommentAdded={() => {
              setIsReplying(false);
              onUpdate();
            }}
            onCancel={() => setIsReplying(false)}
          />
        </div>
      )}

      {showReplies && comment.replies && comment.replies.length > 0 && (
        <div className="space-y-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              documentId={documentId}
              onUpdate={onUpdate}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentItem;