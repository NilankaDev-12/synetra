const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// @route   POST /api/share/:documentId
// @desc    Share document with another user
// @access  Private
router.post('/:documentId', auth, async (req, res) => {
  try {
    const { email, permission } = req.body;
    const { documentId } = req.params;

    // Find document
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Only owner can share
    if (document.owner.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only owner can share document' });
    }

    // Find user to share with
    const userToShare = await User.findOne({ email });
    if (!userToShare) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Don't share with owner
    if (userToShare._id.toString() === req.userId) {
      return res.status(400).json({ message: 'Cannot share with yourself' });
    }

    // Check if already shared
    const alreadyShared = document.sharedWith.some(
      share => share.user.toString() === userToShare._id.toString()
    );

    if (alreadyShared) {
      // Update permission
      const shareIndex = document.sharedWith.findIndex(
        share => share.user.toString() === userToShare._id.toString()
      );
      document.sharedWith[shareIndex].permission = permission || 'view';
    } else {
      // Add new share
      document.sharedWith.push({
        user: userToShare._id,
        permission: permission || 'view'
      });
    }

    await document.save();
    await document.populate('sharedWith.user', 'name email avatar');

    res.json({ 
      message: 'Document shared successfully',
      sharedWith: document.sharedWith
    });
  } catch (error) {
    console.error('Share document error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/share/:documentId/:userId
// @desc    Remove user access from document
// @access  Private
router.delete('/:documentId/:userId', auth, async (req, res) => {
  try {
    const { documentId, userId } = req.params;

    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Only owner can remove access
    if (document.owner.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only owner can remove access' });
    }

    document.sharedWith = document.sharedWith.filter(
      share => share.user.toString() !== userId
    );

    await document.save();

    res.json({ message: 'Access removed successfully' });
  } catch (error) {
    console.error('Remove access error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;