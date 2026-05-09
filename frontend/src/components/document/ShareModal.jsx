import { useState } from 'react';
import { useShareDocument, useRemoveAccess } from '../../hooks/useShare';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import { TrashIcon } from '@heroicons/react/24/outline';
import { getInitials } from '../../utils/helpers';

/**
 * ShareModal — lets the document owner:
 *   • Invite a new user with view or edit permission
 *   • Change an existing user's permission (view ↔ edit)
 *   • Remove a user's access entirely
 */
const ShareModal = ({ isOpen, onClose, document, onUpdate }) => {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState('view');

  const shareDocument = useShareDocument(document._id);
  const removeAccess = useRemoveAccess(document._id);

  // ----------------------------------------------------------------
  // Invite / update an existing user
  // ----------------------------------------------------------------
  const handleShare = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      const result = await shareDocument.mutateAsync({
        email: email.trim(),
        permission,
      });
      setEmail('');
      setPermission('view');

      if (onUpdate && result?.sharedWith) {
        onUpdate(result.sharedWith);
      }
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  // ----------------------------------------------------------------
  // Change permission for an already-shared user
  // ----------------------------------------------------------------
  const handleChangePermission = async (userEmail, newPermission) => {
    try {
      const result = await shareDocument.mutateAsync({
        email: userEmail,
        permission: newPermission,
      });
      if (onUpdate && result?.sharedWith) {
        onUpdate(result.sharedWith);
      }
    } catch (err) {
      console.error('Change permission error:', err);
    }
  };

  // ----------------------------------------------------------------
  // Remove a user's access
  // ----------------------------------------------------------------
  const handleRemoveAccess = async (userId) => {
    if (!window.confirm("Remove this user's access?")) return;
    try {
      await removeAccess.mutateAsync(userId);
      if (onUpdate) {
        onUpdate(document.sharedWith.filter((share) => share.user._id !== userId));
      }
    } catch (err) {
      console.error('Remove access error:', err);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Document">
      {/* ---- Invite form ---- */}
      <form onSubmit={handleShare} className="mb-6">
        <p className="text-sm text-gray-500 mb-3">
          Enter an email address and choose an access level.
        </p>
        <div className="flex space-x-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="flex-1"
          />
          <select
            value={permission}
            onChange={(e) => setPermission(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
          >
            <option value="view">View</option>
            <option value="edit">Edit</option>
          </select>
          <Button type="submit" disabled={shareDocument.isPending}>
            {shareDocument.isPending ? 'Sharing…' : 'Share'}
          </Button>
        </div>
      </form>

      {/* ---- People with access ---- */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          People with access
        </h4>

        {/* Owner row (read-only) */}
        <div className="flex items-center justify-between py-3 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold text-sm">
              {getInitials(document.owner.name)}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {document.owner.name}
              </p>
              <p className="text-xs text-gray-500">{document.owner.email}</p>
            </div>
          </div>
          <span className="text-sm text-gray-500 font-medium">Owner</span>
        </div>

        {/* Shared users */}
        {document.sharedWith && document.sharedWith.length > 0 ? (
          document.sharedWith.map((share) => (
            <div
              key={share.user._id}
              className="flex items-center justify-between py-3 border-b last:border-b-0"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-white font-semibold text-sm">
                  {getInitials(share.user.name)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {share.user.name}
                  </p>
                  <p className="text-xs text-gray-500">{share.user.email}</p>
                </div>
              </div>

              {/* Access control: change permission + remove */}
              <div className="flex items-center space-x-2">
                <select
                  value={share.permission}
                  onChange={(e) =>
                    handleChangePermission(share.user.email, e.target.value)
                  }
                  disabled={shareDocument.isPending}
                  className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors disabled:opacity-50"
                  title="Change access level"
                >
                  <option value="view">View</option>
                  <option value="edit">Edit</option>
                </select>

                <button
                  onClick={() => handleRemoveAccess(share.user._id)}
                  disabled={removeAccess.isPending}
                  className="text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
                  title="Remove access"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500 py-3">
            No one else has access to this document yet.
          </p>
        )}
      </div>
    </Modal>
  );
};

export default ShareModal;