const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const { auth } = require('../middleware/auth');

// @route   GET /api/documents
// @desc    Get all documents for logged in user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    // Find documents where user is owner or in sharedWith array
    const documents = await Document.find({
      $or: [
        { owner: req.userId },
        { 'sharedWith.user': req.userId }
      ]
    })
    .populate('owner', 'name email avatar')
    .populate('sharedWith.user', 'name email avatar')
    .populate('lastEditedBy', 'name email')
    .sort({ updatedAt: -1 });

    res.json({ documents });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/documents/:id
// @desc    Get single document
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('owner', 'name email avatar')
      .populate('sharedWith.user', 'name email avatar')
      .populate('lastEditedBy', 'name email');

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check if user has access
    const hasAccess = document.owner._id.toString() === req.userId ||
      document.sharedWith.some(share => share.user._id.toString() === req.userId);

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ document });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/documents
// @desc    Create a new document
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { title } = req.body;

    const document = new Document({
      title: title || 'Untitled Document',
      owner: req.userId,
      content: '',
      lastEditedBy: req.userId
    });

    await document.save();
    await document.populate('owner', 'name email avatar');

    res.status(201).json({ document });
  } catch (error) {
    console.error('Create document error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/documents/:id
// @desc    Update document
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, content } = req.body;

    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check if user has edit permission
    const isOwner = document.owner.toString() === req.userId;
    const hasEditPermission = document.sharedWith.some(
      share => share.user.toString() === req.userId && share.permission === 'edit'
    );

    if (!isOwner && !hasEditPermission) {
      return res.status(403).json({ message: 'You do not have edit permission' });
    }

    if (title !== undefined) document.title = title;
    if (content !== undefined) document.content = content;
    document.lastEditedBy = req.userId;

    await document.save();
    await document.populate('owner', 'name email avatar');
    await document.populate('sharedWith.user', 'name email avatar');
    await document.populate('lastEditedBy', 'name email');

    res.json({ document });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/documents/:id
// @desc    Delete document
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Only owner can delete
    if (document.owner.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only owner can delete document' });
    }

    await document.deleteOne();

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;