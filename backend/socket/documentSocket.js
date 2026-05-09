const Document = require('../models/Document');
const jwt = require('jsonwebtoken');

const documentSocket = (io) => {
  // documentUsers: Map<documentId, Map<userId, userObject>>
  const documentUsers = new Map();
  // socketToUser: Map<socketId, { documentId, userId }> — lets us handle
  // multi-tab correctly: a user is only removed from presence when their
  // LAST socket (tab) leaves the document.
  const socketToUser = new Map();

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('authenticate', async (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.emit('authenticated', { success: true });
      } catch (error) {
        socket.emit('authenticated', { success: false, message: 'Invalid token' });
        socket.disconnect();
      }
    });

    socket.on('join-document', async ({ documentId }) => {
      try {
        if (!socket.userId) {
          return socket.emit('error', { message: 'Not authenticated' });
        }

        const document = await Document.findById(documentId)
          .populate('owner', 'name email avatar')
          .populate('sharedWith.user', 'name email avatar');

        if (!document) {
          return socket.emit('error', { message: 'Document not found' });
        }

        const isOwner = document.owner._id.toString() === socket.userId;
        const sharedEntry = document.sharedWith.find(
          (share) => share.user._id.toString() === socket.userId
        );

        if (!isOwner && !sharedEntry) {
          return socket.emit('error', { message: 'Access denied' });
        }

        socket.documentId = documentId;
        socket.permission = isOwner ? 'edit' : sharedEntry.permission;

        socket.join(documentId);
        socketToUser.set(socket.id, { documentId, userId: socket.userId });

        const User = require('../models/User');
        const user = await User.findById(socket.userId).select('name email avatar');

        const userObj = {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          avatar: user.avatar,
        };

        if (!documentUsers.has(documentId)) {
          documentUsers.set(documentId, new Map());
        }
        documentUsers.get(documentId).set(socket.userId, userObj);

        const activeUsers = Array.from(documentUsers.get(documentId).values());
        socket.emit('active-users', {
          users: activeUsers.filter((u) => u.id !== socket.userId),
        });

        socket.to(documentId).emit('user-joined', { user: userObj });

        // Ask all other clients in the room to re-broadcast their cursor
        // so the joining user immediately sees where everyone is,
        // without waiting for someone to move.
        socket.to(documentId).emit('request-cursor-broadcast');

        socket.emit('load-document', {
          content: document.content,
          title: document.title,
        });

        console.log(`User ${socket.userId} joined document ${documentId} (${socket.permission})`);
      } catch (error) {
        console.error('Join document error:', error);
        socket.emit('error', { message: 'Failed to join document' });
      }
    });

    // FIX: destructure and forward BOTH delta (html) and json.
    // Previously json was silently dropped, forcing receivers into the
    // imprecise HTML fallback which caused skipped lines / double newlines.
    socket.on('send-changes', async ({ documentId, delta, json }) => {
      try {
        if (!socket.userId || socket.documentId !== documentId) return;

        let canEdit = socket.permission === 'edit';
        if (socket.permission === undefined) {
          const document = await Document.findById(documentId);
          if (!document) return;
          const isOwner = document.owner.toString() === socket.userId;
          const editShare = document.sharedWith.find(
            (s) => s.user.toString() === socket.userId && s.permission === 'edit'
          );
          canEdit = isOwner || !!editShare;
        }

        if (!canEdit) {
          return socket.emit('error', { message: 'No edit permission' });
        }

        // Forward both formats + the sender's userId so the receiver
        // can identify and ignore re-broadcast loops from their own socket.
        socket.to(documentId).emit('receive-changes', {
          delta,
          json,
          senderId: socket.userId,
        });
      } catch (error) {
        console.error('Send changes error:', error);
      }
    });

    socket.on('cursor-position', ({ documentId, position }) => {
      if (socket.documentId !== documentId || !socket.userId) return;

      const userObj = documentUsers.get(documentId)?.get(socket.userId);

      socket.to(documentId).emit('cursor-update', {
        userId: socket.userId.toString(),
        position,
        user: userObj ?? null,
      });
    });

    socket.on('title-change', async ({ documentId, title }) => {
      try {
        if (!socket.userId || socket.documentId !== documentId) return;

        if (socket.permission !== 'edit') {
          return socket.emit('error', { message: 'No edit permission' });
        }

        const document = await Document.findById(documentId);
        if (!document) return;

        document.title = title;
        document.lastEditedBy = socket.userId;
        await document.save();

        socket.to(documentId).emit('title-updated', { title });
      } catch (error) {
        console.error('Title change error:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      _removeUserFromDocument(socket);
    });

    socket.on('leave-document', ({ documentId }) => {
      if (socket.documentId === documentId) {
        socket.leave(documentId);
        _removeUserFromDocument(socket);
        socket.documentId = null;
        socket.permission = undefined;
      }
    });

    function _removeUserFromDocument(socket) {
      if (!socket.documentId || !socket.userId) return;

      // Remove this socket's entry from the tracking map
      socketToUser.delete(socket.id);

      // Count how many OTHER sockets this user still has open in this document
      const remainingSockets = [...socketToUser.values()].filter(
        (entry) => entry.documentId === socket.documentId && entry.userId === socket.userId
      );

      // Only remove presence and notify others when this was the user's LAST tab/socket
      if (remainingSockets.length === 0) {
        const roomMap = documentUsers.get(socket.documentId);
        if (roomMap) {
          roomMap.delete(socket.userId);
          if (roomMap.size === 0) {
            documentUsers.delete(socket.documentId);
          }
        }
        socket.to(socket.documentId).emit('user-left', { userId: socket.userId.toString() });
      }
    }
  });
};

module.exports = documentSocket;