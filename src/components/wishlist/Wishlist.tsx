import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { WishlistItem } from '../../types/user';
import { 
  createWishlistItem, 
  updateWishlistItem, 
  deleteWishlistItem,
  completeWishlistItem,
  uncompleteWishlistItem,
  subscribeToHomeWishlist 
} from '../../services/firebase/wishlist';
import WishlistItemComponent from './WishlistItemComponent';
import AddWishlistItem from './AddWishlistItem';

interface WishlistProps {
  homeId: string;
}

const Wishlist: React.FC<WishlistProps> = ({ homeId }) => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!homeId || !currentUser) return;
    
    // Subscribe to real-time updates
    const unsubscribe = subscribeToHomeWishlist(homeId, (updatedItems) => {
      setItems(updatedItems);
      setLoading(false);
    });

    return () => unsubscribe && unsubscribe();
  }, [homeId, currentUser]);

  const handleAddItem = async (title: string, description?: string, url?: string) => {
    if (!currentUser) return;

    const { item, error } = await createWishlistItem(homeId, currentUser.uid, title, description, url);
    
    if (error) {
      setError('Gagal menambah item: ' + error);
    } else {
      setShowAddForm(false);
    }
  };

  const handleToggleComplete = async (itemId: string, completed: boolean) => {
    if (!currentUser) return;

    try {
      if (completed) {
        const { error } = await completeWishlistItem(itemId, currentUser.uid);
        if (error) {
          setError('Gagal menandai item selesai: ' + error);
        }
      } else {
        const { error } = await uncompleteWishlistItem(itemId);
        if (error) {
          setError('Gagal menandai item belum selesai: ' + error);
        }
      }
    } catch (err: any) {
      setError('Terjadi kesalahan: ' + err.message);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const { error } = await deleteWishlistItem(itemId);
    
    if (error) {
      setError('Gagal menghapus item: ' + error);
    }
  };

  const handleUpdateItem = async (itemId: string, updates: Partial<WishlistItem>) => {
    const { error } = await updateWishlistItem(itemId, updates);
    
    if (error) {
      setError('Gagal mengupdate item: ' + error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-t-transparent border-blue-500 animate-spin"></div>
          <div className="mt-4 text-blue-400 text-sm animate-pulse">Memuat wishlist...</div>
        </div>
      </div>
    );
  }

  const completedItems = items.filter(item => item.completed);
  const pendingItems = items.filter(item => !item.completed);

  return (
    <div className="card-modern h-full flex flex-col overflow-hidden">
      {error && (
        <div className="mx-4 mt-4 p-4 bg-red-900/30 border border-red-500/30 rounded-lg animate-fade-in relative" role="alert">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-red-200">{error}</span>
          </div>
          <button 
            onClick={() => setError('')}
            className="absolute top-2 right-2 text-red-400 hover:text-red-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      
      <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/30 bg-slate-900/30">
        <div>
          <h2 className="text-xl font-semibold text-gradient bg-gradient-to-r from-indigo-400 to-purple-500 mb-1">Wishlist</h2>
          <p className="text-sm text-slate-400">Daftar keinginan anggota rumah</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Mobile tabs */}
          <div className="flex border border-slate-700/50 rounded-lg overflow-hidden sm:hidden">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex-1 py-2 px-3 text-sm font-medium ${
                activeTab === 'pending' 
                  ? 'bg-gradient-to-r from-indigo-600/80 to-purple-600/80 text-white' 
                  : 'bg-slate-800/60 text-slate-300'
              }`}
            >
              Belum Selesai ({pendingItems.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex-1 py-2 px-3 text-sm font-medium ${
                activeTab === 'completed' 
                  ? 'bg-gradient-to-r from-indigo-600/80 to-purple-600/80 text-white' 
                  : 'bg-slate-800/60 text-slate-300'
              }`}
            >
              Selesai ({completedItems.length})
            </button>
          </div>

          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary text-sm px-4 py-2 flex items-center justify-center shadow-soft hover:shadow-medium"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Tambah Item
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-transparent to-slate-800/30">
        {/* Desktop view toggle for completed items */}
        <div className="hidden sm:flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-slate-200">
            {showCompleted ? 'Item Selesai' : 'Item Belum Selesai'}
          </h3>
          <button 
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-sm flex items-center px-4 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 transition-smooth"
          >
            {showCompleted ? (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Lihat Item Belum Selesai ({pendingItems.length})
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Lihat Item Selesai ({completedItems.length})
              </>
            )}
          </button>
        </div>
        
        {/* Mobile view */}
        <div className="sm:hidden">
          {activeTab === 'pending' ? (
            pendingItems.length === 0 ? (
              <div className="text-center p-8 text-slate-400">
                <div className="text-5xl mb-3 opacity-50">📝</div>
                <p>Belum ada item wishlist</p>
                <p className="text-sm mt-2">Tambahkan item pertama Anda untuk berbagi dengan anggota rumah</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingItems.map(item => (
                  <WishlistItemComponent
                    key={item.id}
                    item={item}
                    onToggleComplete={handleToggleComplete}
                    onDelete={handleDeleteItem}
                    onUpdate={handleUpdateItem}
                  />
                ))}
              </div>
            )
          ) : (
            completedItems.length === 0 ? (
              <div className="text-center p-8 text-slate-400">
                <div className="text-5xl mb-3 opacity-50">✓</div>
                <p>Belum ada item yang selesai</p>
                <p className="text-sm mt-2">Selesaikan beberapa item dari daftar Anda</p>
              </div>
            ) : (
              <div className="space-y-4">
                {completedItems.map(item => (
                  <WishlistItemComponent
                    key={item.id}
                    item={item}
                    onToggleComplete={handleToggleComplete}
                    onDelete={handleDeleteItem}
                    onUpdate={handleUpdateItem}
                  />
                ))}
              </div>
            )
          )}
        </div>

        {/* Desktop view */}
        <div className="hidden sm:block">
          {showCompleted ? (
            completedItems.length === 0 ? (
              <div className="text-center p-8 text-slate-400">
                <div className="text-5xl mb-3 opacity-50">✓</div>
                <p>Belum ada item yang selesai</p>
                <p className="text-sm mt-2">Selesaikan beberapa item dari daftar Anda</p>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {completedItems.map(item => (
                  <WishlistItemComponent
                    key={item.id}
                    item={item}
                    onToggleComplete={handleToggleComplete}
                    onDelete={handleDeleteItem}
                    onUpdate={handleUpdateItem}
                  />
                ))}
              </div>
            )
          ) : (
            pendingItems.length === 0 ? (
              <div className="text-center p-8 text-slate-400">
                <div className="text-5xl mb-3 opacity-50">📝</div>
                <p>Belum ada item wishlist</p>
                <p className="text-sm mt-2">Tambahkan item pertama Anda untuk berbagi dengan anggota rumah</p>
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {pendingItems.map(item => (
                  <WishlistItemComponent
                    key={item.id}
                    item={item}
                    onToggleComplete={handleToggleComplete}
                    onDelete={handleDeleteItem}
                    onUpdate={handleUpdateItem}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </div>
      
      {/* Add Wishlist Item Modal */}
      {showAddForm && (
        <AddWishlistItem
          onAdd={handleAddItem}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
};

export default Wishlist;
