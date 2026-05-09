import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ShareIcon,
  CloudArrowUpIcon
} from '@heroicons/react/24/outline';
import Button from '../common/Button';
import { debounce } from '../../utils/helpers';

const DocumentHeader = ({
  document,
  onTitleChange,
  onShare,
  saving,
  isOwner
}) => {
  const navigate = useNavigate();
  const [title, setTitle] = useState(document?.title || '');
  const isFocused = useRef(false);
  const onTitleChangeRef = useRef(onTitleChange);

  useEffect(() => {
    onTitleChangeRef.current = onTitleChange;
  }, [onTitleChange]);

  // Only sync from cache when user is NOT actively editing the field.
  // This prevents rollbacks from resetting the input mid-type.
  useEffect(() => {
    if (!isFocused.current) {
      setTitle(document?.title || '');
    }
  }, [document?._id, document?.title]);

  const debouncedSave = useRef(
    debounce((newTitle) => {
      if (newTitle.trim()) {
        onTitleChangeRef.current(newTitle.trim());
      }
    }, 800)
  ).current;

  const handleFocus = () => {
    isFocused.current = true;
  };

  const handleChange = (e) => {
    if (!isOwner) return;
    const val = e.target.value;
    setTitle(val);
    // Only debounce-save non-empty values
    if (val.trim()) {
      debouncedSave(val);
    }
  };

  const handleBlur = () => {
    isFocused.current = false;
    if (!isOwner) return;

    const trimmed = title.trim();
    if (!trimmed) {
      // Empty — restore to last saved title, don't save
      setTitle(document?.title || 'Untitled Document');
    } else {
      // Save immediately on blur (flush debounce)
      debouncedSave.cancel?.();
      onTitleChangeRef.current(trimmed);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <ArrowLeftIcon className="w-6 h-6" />
          </button>

          <input
            type="text"
            value={title}
            onFocus={handleFocus}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={!isOwner}
            className={`text-xl font-semibold border-none focus:outline-none focus:ring-0 bg-transparent flex-1 transition-colors
              ${isOwner
                ? 'text-gray-800 dark:text-gray-100 cursor-text'
                : 'text-gray-600 dark:text-gray-400 cursor-default'
              }`}
            placeholder="Untitled Document"
            readOnly={!isOwner}
          />

          {saving && (
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <CloudArrowUpIcon className="w-5 h-5 mr-1 animate-pulse" />
              <span>Saving...</span>
            </div>
          )}
        </div>

        {isOwner && (
          <Button
            onClick={onShare}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <ShareIcon className="w-5 h-5" />
            <span>Share</span>
          </Button>
        )}
      </div>
    </div>
  );
};

export default DocumentHeader;