import React, { useState } from 'react';
import { WishlistItem } from '../../types/user';
import { useAuth } from '../../contexts/AuthContext';

interface WishlistItemComponentProps {
  item: WishlistItem;
  onToggleComplete: (itemId: string, completed: boolean) => void;
  onDelete: (itemId: string) => void;
  onUpdate: (itemId: string, updates: Partial<WishlistItem>) => void;
}

const WishlistItemComponent: React.FC<WishlistItemComponentProps> = ({
  item,
  onToggleComplete,
  onDelete,
  onUpdate
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editDescription, setEditDescription] = useState(item.description || '');
  const [editUrl, setEditUrl] = useState(item.url || '');
  const { currentUser } = useAuth();

  const handleSaveEdit = () => {
    onUpdate(item.id, {
      title: editTitle,
      description: editDescription || undefined,
      url: editUrl || undefined,
      updatedAt: new Date()
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(item.title);
    setEditDescription(item.description || '');
    setEditUrl(item.url || '');
    setIsEditing(false);
  };

  const isOwner = currentUser?.uid === item.createdBy;

  return (
    <div className={`bg-white p-4 rounded-lg shadow border-l-4 ${
      item.completed ? 'border-green-500 bg-gray-50' : 'border-indigo-500'
    }`}>
      {isEditing ? (
        <div className="space-y-3">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Judul item"
          />
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Deskripsi (opsional)"
            rows={2}
          />
          <input
            type="url"
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="URL (opsional)"
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={handleCancelEdit}
              className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Batal
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Simpan
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              <button
                onClick={() => onToggleComplete(item.id, !item.completed)}
                className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  item.completed
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300 hover:border-indigo-500'
                }`}
              >
                {item.completed && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              
              <div className="flex-1 min-w-0">
                <h4 className={`text-sm font-medium ${
                  item.completed ? 'text-gray-500 line-through' : 'text-gray-900'
                }`}>
                  {item.title}
                </h4>
                
                {item.description && (
                  <p className={`mt-1 text-sm ${
                    item.completed ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {item.description}
                  </p>
                )}
                
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Lihat Link
                  </a>
                )}
                
                <div className="mt-2 flex items-center text-xs text-gray-500 space-x-4">
                  <span>Dibuat {new Date(item.createdAt).toLocaleDateString('id-ID')}</span>
                  {item.completed && item.completedAt && (
                    <span>Selesai {new Date(item.completedAt).toLocaleDateString('id-ID')}</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Action buttons */}
            {isOwner && (
              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-gray-400 hover:text-indigo-600"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Apakah Anda yakin ingin menghapus item ini?')) {
                      onDelete(item.id);
                    }
                  }}
                  className="text-gray-400 hover:text-red-600"
                  title="Hapus"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WishlistItemComponent;
