import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { leaveHome, deleteHome } from '../../services/firebase/home';
import { Home } from '../../types/user';

interface HomeSettingsProps {
  home: Home;
}

const HomeSettings: React.FC<HomeSettingsProps> = ({ home }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isOwner = currentUser?.uid === home.createdBy;

  const handleLeaveHome = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError('');
      
      const { error } = await leaveHome(currentUser.uid, home.id);
      
      if (error) {
        setError(error);
        return;
      }
      
      // Redirect to home selection after leaving
      navigate('/dashboard');
    } catch (err: any) {
      setError('Gagal keluar dari rumah: ' + err.message);
    } finally {
      setLoading(false);
      setShowLeaveConfirm(false);
    }
  };

  const handleDeleteHome = async () => {
    if (!currentUser || !isOwner) return;
    
    try {
      setLoading(true);
      setError('');
      
      const { error } = await deleteHome(currentUser.uid, home.id);
      
      if (error) {
        setError(error);
        return;
      }
      
      // Redirect to home selection after deleting
      navigate('/dashboard');
    } catch (err: any) {
      setError('Gagal menghapus rumah: ' + err.message);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Home Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Informasi Rumah</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nama Rumah</label>
            <p className="mt-1 text-sm text-gray-900">{home.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Kode Undangan</label>
            <div className="mt-1 flex items-center space-x-2">
              <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{home.inviteCode}</span>
              <button
                onClick={() => navigator.clipboard.writeText(home.inviteCode)}
                className="text-indigo-600 hover:text-indigo-500 text-sm"
              >
                Salin
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Jumlah Anggota</label>
            <p className="mt-1 text-sm text-gray-900">{home.members.length} orang</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <p className="mt-1 text-sm text-gray-900">
              {isOwner ? 'Pemilik' : 'Anggota'}
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Pengaturan</h3>
        <div className="space-y-4">
          {/* Back to Home Selection */}
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Kelola Rumah Lain
          </button>

          {/* Leave Home */}
          {!isOwner && (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              {loading ? 'Memproses...' : 'Keluar dari Rumah'}
            </button>
          )}

          {/* Delete Home (Owner only) */}
          {isOwner && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              {loading ? 'Memproses...' : 'Hapus Rumah'}
            </button>
          )}
        </div>
      </div>

      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Konfirmasi Keluar</h3>
            <p className="text-sm text-gray-500 mb-6">
              Apakah Anda yakin ingin keluar dari rumah "{home.name}"? 
              Anda tidak akan dapat mengakses data di rumah ini lagi.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                onClick={handleLeaveHome}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Memproses...' : 'Ya, Keluar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Konfirmasi Hapus</h3>
            <p className="text-sm text-gray-500 mb-6">
              Apakah Anda yakin ingin menghapus rumah "{home.name}"? 
              <strong className="text-red-600">Semua data (notes, wishlist, chat) akan terhapus permanen</strong> dan tidak dapat dikembalikan.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteHome}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Memproses...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeSettings;
