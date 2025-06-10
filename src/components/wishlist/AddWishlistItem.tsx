import React, { useState } from 'react';

interface AddWishlistItemProps {
  onAdd: (title: string, description?: string, url?: string) => Promise<void>;
  onCancel: () => void;
}

const AddWishlistItem: React.FC<AddWishlistItemProps> = ({ onAdd, onCancel }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onAdd(
        title.trim(), 
        description.trim() || undefined, 
        url.trim() || undefined
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center animate-fade-in">
      <div className="relative mx-auto p-6 w-full max-w-md card-modern shadow-hard">
        <div className="mt-1">
          <h3 className="text-xl font-semibold text-gradient bg-gradient-to-r from-blue-400 to-indigo-500 mb-5">
            Tambah Item Wishlist
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-slate-300 mb-1.5">
                Judul <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-modern w-full shadow-soft focus:shadow-medium"
                placeholder="Masukkan judul item"
                required
                disabled={isSubmitting}
                autoFocus
              />
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-1.5">
                Deskripsi
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="input-modern w-full shadow-soft focus:shadow-medium resize-none"
                placeholder="Tambahkan deskripsi (opsional)"
                disabled={isSubmitting}
              />
            </div>
            
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-slate-300 mb-1.5">
                URL/Link
              </label>
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="input-modern w-full shadow-soft focus:shadow-medium"
                placeholder="https://example.com (opsional)"
                disabled={isSubmitting}
              />
            </div>
            
            <div className="flex justify-end space-x-3 pt-5">
              <button
                type="button"
                onClick={onCancel}
                className="btn-secondary text-sm px-5 py-2.5 flex items-center"
                disabled={isSubmitting}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Batal
              </button>
              <button
                type="submit"
                className="btn-primary text-sm px-5 py-2.5 flex items-center shadow-soft hover:shadow-medium disabled:opacity-50"
                disabled={isSubmitting || !title.trim()}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-2"></div>
                    Menambahkan...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Tambah Item
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
        
        {/* Close button */}
        <button 
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-smooth p-1 rounded-full hover:bg-slate-700/50"
          onClick={onCancel}
          disabled={isSubmitting}
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default AddWishlistItem;
