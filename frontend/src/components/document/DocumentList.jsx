import { useNavigate } from 'react-router-dom';
import { useDocuments, useCreateDocument, useDeleteDocument } from '../../hooks/useDocuments';
import { formatDate } from '../../utils/helpers';
import {
  PlusIcon,
  DocumentTextIcon,
  TrashIcon,
  ShareIcon
} from '@heroicons/react/24/outline';
import Button from '../common/Button';
import Loading from '../common/Loading';

const DocumentList = () => {
  const navigate = useNavigate();
  const { data: documents, isLoading, error } = useDocuments();
  const createDocument = useCreateDocument();
  const deleteDocument = useDeleteDocument();

  const handleCreateDocument = async () => {
    try {
      const response = await createDocument.mutateAsync({ title: 'Untitled Document' });
      const newDoc = response.data.document;
      navigate(`/document/${newDoc._id}`);
    } catch (error) {
      console.error('Create document error:', error);
    }
  };

  const handleDeleteDocument = async (docId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await deleteDocument.mutateAsync(docId);
    } catch (error) {
      console.error('Delete document error:', error);
    }
  };

  const handleOpenDocument = (docId) => {
    navigate(`/document/${docId}`);
  };

  if (isLoading) return <Loading fullScreen />;

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">Failed to load documents</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">My Documents</h1>
        <Button
          onClick={handleCreateDocument}
          className="flex items-center space-x-2"
          disabled={createDocument.isPending}
        >
          <PlusIcon className="w-5 h-5" />
          <span>{createDocument.isPending ? 'Creating...' : 'New Document'}</span>
        </Button>
      </div>

      {documents?.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg shadow">
          <DocumentTextIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No documents yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Get started by creating a new document</p>
          <Button onClick={handleCreateDocument}>Create Your First Document</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents?.map((doc) => (
            <div
              key={doc._id}
              onClick={() => handleOpenDocument(doc._id)}
              className="bg-white dark:bg-gray-900 border border-transparent dark:border-gray-700 rounded-lg shadow hover:shadow-lg transition-all cursor-pointer p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <DocumentTextIcon className="w-8 h-8 text-primary-600" />
                <div className="flex space-x-2">
                  <button
                    onClick={(e) => handleDeleteDocument(doc._id, e)}
                    className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    disabled={deleteDocument.isPending}
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 truncate">
                {doc.title}
              </h3>

              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Last edited {formatDate(doc.updatedAt)}
              </p>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Owner: {doc.owner.name}
                </span>
                {doc.sharedWith.length > 0 && (
                  <div className="flex items-center text-gray-500 dark:text-gray-400">
                    <ShareIcon className="w-4 h-4 mr-1" />
                    <span>{doc.sharedWith.length}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentList;