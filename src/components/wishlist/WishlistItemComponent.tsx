// filepath: e:\Rumah Kita\src\components\wishlist\WishlistItemComponent.tsx
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
  const [hoverRating, setHoverRating] = useState(0);
  const [isEditingRating, setIsEditingRating] = useState(false);
  const [currentRating, setCurrentRating] = useState(item.rating || 0);
  const [ratingComment, setRatingComment] = useState(item.ratingComment || '');
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

  const handleRating = (rating: number) => {
    setCurrentRating(rating);
  };

  const handleSaveRating = () => {
    onUpdate(item.id, {
      rating: currentRating,
      ratingComment,
      updatedAt: new Date()
    });
    setIsEditingRating(false);
  };

  const handleCancelRating = () => {
    setCurrentRating(item.rating || 0);
    setRatingComment(item.ratingComment || '');
    setIsEditingRating(false);
  };

  const isOwner = currentUser?.uid === item.createdBy;
  
  // Star rating component
  const StarRating = () => {
    return (
      <div className="flex items-center mt-2">
        <span className="text-xs text-slate-400 mr-2">Rating:</span>
        <div className="flex">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className={`w-5 h-5 ${
                (hoverRating || currentRating) >= star 
                  ? 'text-yellow-500' 
                  : 'text-slate-600'
              }`}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => handleRating(star)}
            >
              <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Rating display with edit option
  const RatingDisplay = () => {
    return (
      <div className="mt-2 pt-2 border-t border-slate-700/30">
        {item.rating && !isEditingRating ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-xs text-slate-400 mr-2">Rating:</span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={`w-4 h-4 ${
                        (item.rating || 0) >= star 
                          ? 'text-yellow-500' 
                          : 'text-slate-600'
                      }`}
                    >
                      <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setIsEditingRating(true)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-smooth"
              >
                Edit
              </button>
            </div>
            
            {item.ratingComment && (
              <div className="mt-1.5">
                <p className="text-xs text-slate-400">Komentar:</p>
                <p className="text-xs text-slate-300 mt-1 bg-slate-800/30 rounded-md p-2">
                  {item.ratingComment}
                </p>
              </div>
            )}
          </div>
        ) : isEditingRating ? (
          <div className="space-y-3 animate-fade-in">
            <div>
              <div className="flex items-center">
                <span className="text-xs text-slate-400 mr-2">Rating:</span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`w-5 h-5 ${
                        (hoverRating || currentRating) >= star 
                          ? 'text-yellow-500' 
                          : 'text-slate-600'
                      }`}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => handleRating(star)}
                    >
                      <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Komentar:</label>
              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                className="input-modern w-full resize-none text-sm"
                placeholder="Tambahkan komentar tentang item ini"
                rows={2}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCancelRating}
                className="btn-secondary text-xs px-2 py-1 flex items-center"
              >
                Batal
              </button>
              <button
                onClick={handleSaveRating}
                className="btn-primary text-xs px-2 py-1 flex items-center"
              >
                Simpan
              </button>
            </div>
          </div>
        ) : (
          <StarRating />
        )}
      </div>
    );
  };

  return (
    <div className={`glassmorphism p-4 rounded-xl shadow-soft border-l-4 transition-smooth animate-fade-in ${
      item.completed 
        ? 'border-l-green-500/70 bg-green-900/10' 
        : 'border-l-blue-500/70 hover:bg-slate-800/30'
    }`}>
      {isEditing ? (
        <div className="space-y-3 animate-scale-in">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="input-modern w-full"
            placeholder="Judul item"
            autoFocus
          />
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            className="input-modern w-full resize-none"
            placeholder="Deskripsi (opsional)"
            rows={2}
          />
          <input
            type="url"
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            className="input-modern w-full"
            placeholder="URL (opsional)"
          />
          <div className="flex justify-end space-x-2 pt-2">
            <button
              onClick={handleCancelEdit}
              className="btn-secondary text-sm px-3 py-1.5 flex items-center"
            >
              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Batal
            </button>
            <button
              onClick={handleSaveEdit}
              className="btn-primary text-sm px-3 py-1.5 flex items-center"
            >
              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
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
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-400 text-white shadow-soft'
                    : 'border-slate-600 hover:border-blue-500 transition-smooth'
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
                  item.completed ? 'text-slate-400 line-through' : 'text-white'
                }`}>
                  {item.title}
                </h4>
                
                {item.description && (
                  <p className={`mt-1.5 text-sm ${
                    item.completed ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    {item.description}
                  </p>
                )}
                
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center text-sm text-blue-400 hover:text-blue-300 transition-smooth"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Lihat Link
                  </a>
                )}
                
                <div className="mt-2 flex flex-wrap items-center text-xs text-slate-500 space-x-4">
                  <span className="flex items-center">
                    <svg className="w-3 h-3 mr-1 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {new Date(item.createdAt).toLocaleDateString('id-ID')}
                  </span>
                  {item.completed && item.completedAt && (
                    <span className="flex items-center text-green-500/70">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {new Date(item.completedAt).toLocaleDateString('id-ID')}
                    </span>
                  )}
                </div>
                
                {/* Show rating UI only for completed items */}
                {item.completed && (
                  <RatingDisplay />
                )}
              </div>
            </div>
            
            {/* Action buttons */}
            {isOwner && (
              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-slate-400 hover:text-blue-400 transition-smooth p-1 rounded-full hover:bg-blue-900/20"
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
                  className="text-slate-400 hover:text-red-400 transition-smooth p-1 rounded-full hover:bg-red-900/20"
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
