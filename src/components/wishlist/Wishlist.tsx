import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { WishlistItem } from '../../types/user';
import { 
  createWishlistItem, 
  updateWishlistItem, 
  deleteWishlistItem,
  subscribeToHomeWishlist 
} from '../../services/firebase/wishlist';
import WishlistItemComponent from 'components/wishlist/WishlistItemComponent';
import AddWishlistItem from 'components/wishlist/AddWishlistItem';

interface WishlistProps {
  homeId: string;
}

const Wishlist: React.FC<WishlistProps> = ({ homeId }) => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!homeId || !currentUser) return;    // Subscribe to real-time updates
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

    const { error } = await updateWishlistItem(itemId, { 
      completed,
      completedBy: completed ? currentUser.uid : undefined,
      completedAt: completed ? new Date() : undefined
    });
    
    if (error) {
      setError('Gagal mengupdate item: ' + error);
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
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const completedItems = items.filter(item => item.completed);
  const pendingItems = items.filter(item => !item.completed);

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
          <button 
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setError('')}
          >
            <span className="sr-only">Dismiss</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Wishlist Bersama</h2>
          <p className="text-sm text-gray-600">
            {items.length} item total • {completedItems.length} selesai • {pendingItems.length} sedang berlangsung
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center"
        >
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Tambah Item
        </button>
      </div>

      {/* Add Item Form Modal */}
      {showAddForm && (
        <AddWishlistItem
          onAdd={handleAddItem}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Items List */}
      <div className="space-y-6">
        {/* Pending Items */}
        {pendingItems.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Dalam Proses</h3>
            <div className="space-y-3">
              {pendingItems.map((item) => (
                <WishlistItemComponent
                  key={item.id}
                  item={item}
                  onToggleComplete={handleToggleComplete}
                  onDelete={handleDeleteItem}
                  onUpdate={handleUpdateItem}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed Items */}
        {completedItems.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Selesai</h3>
            <div className="space-y-3">
              {completedItems.map((item) => (
                <WishlistItemComponent
                  key={item.id}
                  item={item}
                  onToggleComplete={handleToggleComplete}
                  onDelete={handleDeleteItem}
                  onUpdate={handleUpdateItem}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {items.length === 0 && (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Belum ada wishlist</h3>
            <p className="mt-1 text-sm text-gray-500">
              Mulai dengan menambahkan item pertama ke wishlist bersama kalian.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Tambah Item Pertama
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Wishlist;
