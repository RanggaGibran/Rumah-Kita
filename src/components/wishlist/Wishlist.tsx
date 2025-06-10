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
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="loading-spinner"></div>
          <div className="mt-4 text-blue-400 text-sm animate-pulse">Memuat wishlist...</div>
        </div>
      </div>
    );
  }

  const completedItems = items.filter(item => item.completed);
  const pendingItems = items.filter(item => !item.completed);

  return (
    <div className="card-modern p-6 h-full flex flex-col overflow-hidden">
      {error && (
        <div className="mb-4 p-4 bg-red-900/30 border border-red-500/30 rounded-lg animate-fade-in relative" role="alert">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-red-200">{error}</span>
          </div>
          <button 
            onClick={() => setError('')}
            className="absolute top-3 right-3 text-red-400 hover:text-red-300 transition-smooth"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-700/30">
        <div>
          <h2 className="text-2xl font-semibold text-gradient bg-gradient-to-r from-blue-400 to-indigo-500">Wishlist Bersama</h2>
          <p className="text-sm text-slate-400 mt-1 flex items-center space-x-3">
            <span className="flex items-center">
              <span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1.5"></span>
              {items.length} item total
            </span>
            <span className="flex items-center">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1.5"></span>
              {completedItems.length} selesai
            </span>
            <span className="flex items-center">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1.5"></span>
              {pendingItems.length} dalam proses
            </span>
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary text-sm px-4 py-2 flex items-center shadow-soft hover:shadow-medium"
        >
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      <div className="flex-1 overflow-y-auto space-y-6 pr-2">
        {/* Pending Items */}
        {pendingItems.length > 0 && (
          <div className="animate-fade-in">
            <h3 className="text-lg font-medium text-white opacity-80 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Dalam Proses
            </h3>
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
          <div className="animate-fade-in">
            <h3 className="text-lg font-medium text-white opacity-80 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Selesai
            </h3>
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
          <div className="text-center py-12 flex flex-col items-center justify-center animate-fade-in h-full">
            <div className="relative w-24 h-24 mb-6">
              <svg
                className="absolute w-24 h-24 text-blue-900/20 animate-float"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <svg
                className="absolute w-20 h-20 text-indigo-500/10 top-2 left-2 animate-float"
                style={{ animationDelay: '1.5s' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <h3 className="mt-2 text-xl font-medium text-gradient bg-gradient-to-r from-blue-400 to-indigo-500">Belum ada wishlist</h3>
            <p className="mt-4 text-sm text-slate-400 max-w-md">
              Mulai dengan menambahkan item pertama ke wishlist bersama kalian. Kumpulkan daftar keinginan untuk rumah kalian di sini!
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-8 btn-primary text-sm px-6 py-3 flex items-center mx-auto shadow-soft hover:shadow-medium hover:scale-105 transition-smooth"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Item Pertama
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Wishlist;
