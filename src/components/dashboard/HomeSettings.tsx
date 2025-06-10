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
    <div className="space-y-6 p-6">
      {/* Home Information */}
      <div className="card-modern p-8">
        <h3 className="text-xl font-semibold text-gradient mb-6">Informasi Rumah</h3>
        <div className="space-y-4">
          <div className="p-4 glassmorphism rounded-lg">
            <label className="block text-sm font-medium text-slate-300 mb-2">Nama Rumah</label>
            <p className="text-lg font-medium text-white">{home.name}</p>
          </div>
          <div className="p-4 glassmorphism rounded-lg">
            <label className="block text-sm font-medium text-slate-300 mb-2">Kode Undangan</label>
            <div className="flex items-center space-x-3">
              <span className="text-sm font-mono bg-slate-800/60 px-3 py-2 rounded-lg text-cyan-300 border border-slate-600/30">
                {home.inviteCode}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(home.inviteCode)}
                className="btn-secondary text-sm px-3 py-2 transition-smooth hover:bg-blue-600/20 hover:text-blue-300"
              >
                Salin
              </button>
            </div>
          </div>
          <div className="p-4 glassmorphism rounded-lg">
            <label className="block text-sm font-medium text-slate-300 mb-2">Jumlah Anggota</label>
            <p className="text-lg font-medium text-white">{home.members.length} orang</p>
          </div>
          <div className="p-4 glassmorphism rounded-lg">
            <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
            <p className="text-lg font-medium text-white">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                isOwner 
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30' 
                  : 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
              }`}>
                {isOwner ? '👑 Pemilik' : '👤 Anggota'}
              </span>
            </p>
          </div>
        </div>
      </div>      {/* Error Message */}
      {error && (
        <div className="card-modern bg-red-900/30 border-red-500/30 p-4" role="alert">
          <div className="flex items-center space-x-3">
            <div className="text-red-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-red-200 font-medium">{error}</span>
          </div>
        </div>
      )}      {/* Actions */}
      <div className="card-modern p-8">
        <h3 className="text-xl font-semibold text-gradient mb-6">Pengaturan</h3>
        <div className="space-y-4">
          {/* Back to Home Selection */}
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full btn-secondary p-4 text-center font-medium transition-smooth hover:scale-[1.02] focus-ring"
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
              </svg>
              <span>Kelola Rumah Lain</span>
            </div>
          </button>

          {/* Leave Home */}
          {!isOwner && (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              disabled={loading}
              className="w-full p-4 bg-red-900/30 border border-red-500/30 rounded-lg text-red-300 font-medium transition-smooth hover:bg-red-900/50 hover:border-red-400/50 hover:scale-[1.02] focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>{loading ? 'Memproses...' : 'Keluar dari Rumah'}</span>
              </div>
            </button>
          )}

          {/* Delete Home (Owner only) */}
          {isOwner && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
              className="w-full p-4 bg-red-900/30 border border-red-500/30 rounded-lg text-red-300 font-medium transition-smooth hover:bg-red-900/50 hover:border-red-400/50 hover:scale-[1.02] focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>{loading ? 'Memproses...' : 'Hapus Rumah'}</span>
              </div>
            </button>
          )}
        </div>
      </div>      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-modern p-8 max-w-md w-full animate-scale-in">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.08 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Konfirmasi Keluar</h3>
            </div>
            <p className="text-slate-300 mb-8 text-center leading-relaxed">
              Apakah Anda yakin ingin keluar dari rumah <span className="font-semibold text-white">"{home.name}"</span>? 
              Anda tidak akan dapat mengakses data di rumah ini lagi.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="btn-secondary px-6 py-3 transition-smooth hover:scale-105 focus-ring"
              >
                Batal
              </button>
              <button
                onClick={handleLeaveHome}
                disabled={loading}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium transition-smooth hover:bg-red-700 hover:scale-105 focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="loading-spinner"></div>
                    <span>Memproses...</span>
                  </div>
                ) : (
                  'Ya, Keluar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-modern p-8 max-w-md w-full animate-scale-in">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Konfirmasi Hapus</h3>
            </div>
            <div className="text-center mb-8">
              <p className="text-slate-300 mb-4 leading-relaxed">
                Apakah Anda yakin ingin menghapus rumah <span className="font-semibold text-white">"{home.name}"</span>?
              </p>
              <div className="card-modern bg-red-900/30 border-red-500/30 p-4">
                <p className="text-red-200 font-medium text-sm">
                  ⚠️ Semua data (notes, wishlist, chat) akan terhapus permanen dan tidak dapat dikembalikan.
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary px-6 py-3 transition-smooth hover:scale-105 focus-ring"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteHome}
                disabled={loading}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium transition-smooth hover:bg-red-700 hover:scale-105 focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="loading-spinner"></div>
                    <span>Memproses...</span>
                  </div>
                ) : (
                  'Ya, Hapus'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeSettings;
