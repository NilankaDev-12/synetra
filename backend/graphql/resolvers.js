const Comment = require('../models/Comment');
const Document = require('../models/Document');

// FIX: Helper to throw a clean 401 when context.userId is missing.
// Prevents confusing cast errors when GraphQL auth silently fails.
const requireAuth = (context) => {
  if (!context.user || !context.userId) {
    throw new Error('Not authenticated');
  }
};

const resolvers = {
  Query: {
    getComments: async (_, { documentId }, context) => {
      try {
        requireAuth(context);

        const document = await Document.findById(documentId);
        if (!document) throw new Error('Document not found');

        const hasAccess =
          document.owner.toString() === context.userId ||
          document.sharedWith.some(share => share.user.toString() === context.userId);

        if (!hasAccess) throw new Error('Access denied');

        const comments = await Comment.find({ document: documentId, parentComment: null })
          .populate('author', 'name email avatar')
          .sort({ createdAt: -1 });

        return comments;
      } catch (error) {
        throw new Error(error.message);
      }
    },

    getComment: async (_, { commentId }, context) => {
      try {
        requireAuth(context);

        const comment = await Comment.findById(commentId)
          .populate('author', 'name email avatar');

        if (!comment) throw new Error('Comment not found');
        return comment;
      } catch (error) {
        throw new Error(error.message);
      }
    },
  },

  Mutation: {
    createComment: async (_, { documentId, content, parentCommentId }, context) => {
      try {
        requireAuth(context);

        const document = await Document.findById(documentId);
        if (!document) throw new Error('Document not found');

        const hasAccess =
          document.owner.toString() === context.userId ||
          document.sharedWith.some(share => share.user.toString() === context.userId);

        if (!hasAccess) throw new Error('Access denied');

        if (parentCommentId) {
          const parentComment = await Comment.findById(parentCommentId);
          if (!parentComment) throw new Error('Parent comment not found');
        }

        const comment = new Comment({
          document: documentId,
          author: context.userId,
          content,
          parentComment: parentCommentId || null,
        });

        await comment.save();
        await comment.populate('author', 'name email avatar');
        return comment;
      } catch (error) {
        throw new Error(error.message);
      }
    },

    updateComment: async (_, { commentId, content }, context) => {
      try {
        requireAuth(context);

        const comment = await Comment.findById(commentId);
        if (!comment) throw new Error('Comment not found');

        if (comment.author.toString() !== context.userId)
          throw new Error('Not authorized to update this comment');

        comment.content = content;
        await comment.save();
        await comment.populate('author', 'name email avatar');
        return comment;
      } catch (error) {
        throw new Error(error.message);
      }
    },

    deleteComment: async (_, { commentId }, context) => {
      try {
        requireAuth(context);

        const comment = await Comment.findById(commentId);
        if (!comment) throw new Error('Comment not found');

        if (comment.author.toString() !== context.userId)
          throw new Error('Not authorized to delete this comment');

        await Comment.deleteMany({ parentComment: commentId });
        await comment.deleteOne();
        return 'Comment deleted successfully';
      } catch (error) {
        throw new Error(error.message);
      }
    },
  },

  Comment: {
    replies: async (parent) => {
      return await Comment.find({ parentComment: parent._id })
        .populate('author', 'name email avatar')
        .sort({ createdAt: 1 });
    },
    // Mongoose Date objects serialize via .toString() when typed as GraphQL
    // String — the output format varies by Node version and is not always
    // parseable by `new Date()` in the browser. Always emit an ISO 8601
    // string so date-fns can parse it reliably.
    createdAt: (parent) => {
      const d = parent.createdAt;
      if (!d) return new Date().toISOString();
      return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
    },
    updatedAt: (parent) => {
      const d = parent.updatedAt;
      if (!d) return new Date().toISOString();
      return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
    },
  },
};

module.exports = resolvers;