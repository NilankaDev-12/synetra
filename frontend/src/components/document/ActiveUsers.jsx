import { getInitials } from '../../utils/helpers';

/**
 * Shows avatars for every peer currently in the document.
 * Each avatar uses the same color assigned to that user's in-editor cursor
 * decoration, so the ring color matches the caret/label they see in the text.
 *
 * Props
 *   users   – array of { id, name, email, avatar }
 *   cursors – object { [userId]: { color, position, user } }  (optional)
 */
const ActiveUsers = ({ users, cursors = {} }) => {
  if (!users || users.length === 0) return null;

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center space-x-3">
        <span className="text-sm text-gray-500">Also editing:</span>
        <div className="flex -space-x-2">
          {users.map((user) => {
            // Use the cursor color for this user if available, otherwise fall
            // back to a neutral indigo so the avatar always looks intentional.
            const color = cursors[user.id]?.color ?? '#4f46e5';
            return (
              <div
                key={user.id}
                title={user.name}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold border-2 border-white select-none"
                style={{ backgroundColor: color }}
              >
                {getInitials(user.name)}
              </div>
            );
          })}
        </div>
        <span className="text-sm text-gray-400">
          {users.length === 1 ? '1 other person' : `${users.length} others`}
        </span>
      </div>
    </div>
  );
};

export default ActiveUsers;