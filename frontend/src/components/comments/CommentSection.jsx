import { useEffect } from 'react';
import { useQuery, gql } from '@apollo/client';
import CommentItem from './CommentItem';
import CommentForm from './CommentForm';
import Loading from '../common/Loading';

const GET_COMMENTS = gql`
  query GetComments($documentId: ID!) {
    getComments(documentId: $documentId) {
      id
      content
      author {
        id
        name
        email
        avatar
      }
      createdAt
      updatedAt
      replies {
        id
        content
        author {
          id
          name
          email
          avatar
        }
        createdAt
        updatedAt
      }
    }
  }
`;

const CommentSection = ({ documentId }) => {
  const { loading, error, data, refetch } = useQuery(GET_COMMENTS, {
    variables: { documentId },
    fetchPolicy: 'network-only',
  });

  // FIX: include refetch in dependency array — avoids stale-closure and
  // prevents infinite refetch loops in some React Query versions.
  useEffect(() => {
    refetch();
  }, [documentId, refetch]);

  if (loading) return <Loading />;
  if (error) return <p className="text-red-500 text-sm">Error loading comments</p>;

  const comments = data?.getComments || [];

  return (
    <div className="space-y-4">
      <CommentForm
        documentId={documentId}
        onCommentAdded={() => refetch()}
      />

      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
        {comments.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              documentId={documentId}
              onUpdate={() => refetch()}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default CommentSection;
