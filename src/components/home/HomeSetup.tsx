import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  createHome, 
  joinHomeByInviteCode, 
  getUserHomes, 
  leaveHome, 
  deleteHome, 
  regenerateInviteCode,
  getHomeStatistics 
} from '../../services/firebase/home';
import { Home } from '../../types/user';

const HomeSetup: React.FC = () => {
  const [homeName, setHomeName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [homes, setHomes] = useState<Home[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState<{
    type: 'leave' | 'delete' | 'regenerate';
    homeId: string;
    homeName: string;
  } | null>(null);
  const [homeStats, setHomeStats] = useState<{[key: string]: any}>({});
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const fetchUserHomes = async () => {
    if (currentUser) {
      setLoading(true);
      const { homes, error } = await getUserHomes(currentUser.uid);
      if (error) {
        setError(error);
      } else {
        setHomes(homes);
        
        // Fetch statistics for each home
        const stats: {[key: string]: any} = {};
        for (const home of homes) {
          const { statistics } = await getHomeStatistics(home.id);
          if (statistics) {
            stats[home.id] = statistics;
          }
        }
        setHomeStats(stats);
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserHomes();
  }, [currentUser]);

  const handleCreateHome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError('');
      
      const { home, error } = await createHome(currentUser.uid, homeName || 'Rumah Kita');
      
      if (error) {
        setError(error);
        return;
      }
      
      if (home) {
        setSuccess(`Rumah "${home.name}" berhasil dibuat! Kode undangan: ${home.inviteCode}`);
        setHomeName('');
        fetchUserHomes();
      }
    } catch (err: any) {
      setError('Gagal membuat rumah: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinHome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError('');
      
      const { success, home, error } = await joinHomeByInviteCode(currentUser.uid, inviteCode);
      
      if (error) {
        setError(error);
        return;
      }
      
      if (success && home) {
        setSuccess(`Berhasil bergabung ke rumah "${home.name}"`);
        setInviteCode('');
        fetchUserHomes();
      }
    } catch (err: any) {
      setError('Gagal bergabung ke rumah: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveHome = async (homeId: string) => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError('');
      
      const { success, error } = await leaveHome(currentUser.uid, homeId);
      
      if (error) {
        setError(error);
        return;
      }
      
      if (success) {
        setSuccess('Berhasil keluar dari rumah');
        fetchUserHomes();
      }
    } catch (err: any) {
      setError('Gagal keluar dari rumah: ' + err.message);
    } finally {
      setLoading(false);
      setShowConfirmDialog(null);
    }
  };

  const handleDeleteHome = async (homeId: string) => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError('');
      
      const { success, error } = await deleteHome(currentUser.uid, homeId);
      
      if (error) {
        setError(error);
        return;
      }
      
      if (success) {
        setSuccess('Rumah berhasil dihapus');
        fetchUserHomes();
      }
    } catch (err: any) {
      setError('Gagal menghapus rumah: ' + err.message);
    } finally {
      setLoading(false);
      setShowConfirmDialog(null);
    }
  };

  const handleRegenerateCode = async (homeId: string) => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError('');
      
      const { success, error, inviteCode: newCode } = await regenerateInviteCode(currentUser.uid, homeId);
      
      if (error) {
        setError(error);
        return;
      }
      
      if (success && newCode) {
        setSuccess(`Kode undangan baru berhasil dibuat: ${newCode}`);
        fetchUserHomes();
      }
    } catch (err: any) {
      setError('Gagal membuat kode undangan baru: ' + err.message);
    } finally {
      setLoading(false);
      setShowConfirmDialog(null);
    }
  };

  const ConfirmDialog = () => {
    if (!showConfirmDialog) return null;

    const { type, homeId, homeName } = showConfirmDialog;
    
    const getDialogContent = () => {
      switch (type) {
        case 'leave':
          return {
            title: 'Keluar dari Rumah',
            message: `Apakah Anda yakin ingin keluar dari rumah "${homeName}"?`,
            confirmText: 'Keluar',
            confirmAction: () => handleLeaveHome(homeId),
            confirmClass: 'bg-red-500 hover:bg-red-600 transition-smooth'
          };
        case 'delete':
          return {
            title: 'Hapus Rumah',
            message: `Apakah Anda yakin ingin menghapus rumah "${homeName}"? Tindakan ini tidak dapat dibatalkan.`,
            confirmText: 'Hapus',
            confirmAction: () => handleDeleteHome(homeId),
            confirmClass: 'bg-red-500 hover:bg-red-600 transition-smooth'
          };
        case 'regenerate':
          return {
            title: 'Buat Kode Undangan Baru',
            message: `Apakah Anda yakin ingin membuat kode undangan baru untuk rumah "${homeName}"? Kode lama akan tidak berlaku lagi.`,
            confirmText: 'Buat Baru',
            confirmAction: () => handleRegenerateCode(homeId),
            confirmClass: 'bg-yellow-500 hover:bg-yellow-600 transition-smooth'
          };
        default:
          return null;
      }
    };

    const dialogContent = getDialogContent();
    if (!dialogContent) return null;

    return (
      <div className="fixed inset-0 bg-gray-900 bg-opacity-70 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center animate-fade-in">
        <div className="card-modern w-96 p-5 animate-scale-in shadow-hard">
          <div className="mt-3 text-center">
            <h3 className="text-lg font-semibold text-gradient">{dialogContent.title}</h3>
            <div className="mt-2 px-7 py-3">
              <p className="text-sm text-gray-300">{dialogContent.message}</p>
            </div>
            <div className="flex justify-center space-x-4 px-4 py-3">
              <button
                onClick={() => setShowConfirmDialog(null)}
                className="btn-secondary px-5 py-2"
              >
                Batal
              </button>
              <button
                onClick={dialogContent.confirmAction}
                disabled={loading}
                className={`px-5 py-2 rounded-xl shadow-soft transition-all ${dialogContent.confirmClass} text-white`}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="loading-spinner mr-2"></div>
                    <span>Memproses...</span>
                  </div>
                ) : dialogContent.confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-modern p-8 animate-fade-in text-center">
          <p className="text-lg font-medium text-gray-200 mb-4">Silakan login terlebih dahulu</p>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-center text-3xl font-bold text-gradient mb-10">
          Selamat Datang di Rumah Kita
        </h2>
        
        {homes.length > 0 && (
          <div className="mb-10 card-modern p-1 shadow-hard animate-slide-up">
            <div className="glassmorphism rounded-t-xl px-6 py-4">
              <h3 className="text-xl font-semibold text-gradient">
                Rumah Anda
              </h3>
            </div>
            
            <div className="divide-y divide-gray-700">
              <ul>
                {homes.map((home) => {
                  const stats = homeStats[home.id];
                  return (
                    <li key={home.id} className="transition-smooth hover:bg-slate-800/30 rounded-xl">
                      <div className="px-6 py-4">
                        <div className="flex items-center justify-between flex-wrap sm:flex-nowrap gap-4">
                          <div className="flex-1">
                            <p className="text-lg font-semibold text-gradient">
                              {home.name}
                            </p>
                            <div className="mt-2 flex items-center text-sm text-gray-300">
                              <div className="flex items-center bg-slate-800/80 px-3 py-1 rounded-full shadow-soft">
                                <span>Kode: </span>
                                <span className="ml-1 font-medium text-blue-400">{home.inviteCode}</span>
                              </div>
                              {home.createdBy === currentUser?.uid && (
                                <span className="ml-2 px-3 py-1 text-xs bg-blue-900/50 text-blue-300 border border-blue-500/30 rounded-full shadow-soft">
                                  Owner
                                </span>
                              )}
                            </div>
                            <div className="mt-3 text-sm text-gray-400 flex flex-wrap gap-3">
                              <div className="flex items-center px-2 py-1 bg-slate-800/30 rounded-lg shadow-soft">
                                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1.5"></span>
                                <span>{home.members.length} anggota</span>
                              </div>
                              
                              {stats && (
                                <>
                                  <div className="flex items-center px-2 py-1 bg-slate-800/30 rounded-lg shadow-soft">
                                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1.5"></span>
                                    <span>{stats.notesCount || 0} catatan</span>
                                  </div>
                                  
                                  <div className="flex items-center px-2 py-1 bg-slate-800/30 rounded-lg shadow-soft">
                                    <span className="inline-block w-2 h-2 bg-purple-500 rounded-full mr-1.5"></span>
                                    <span>{stats.wishlistCount || 0} wishlist</span>
                                  </div>
                                  
                                  <div className="flex items-center px-2 py-1 bg-slate-800/30 rounded-lg shadow-soft">
                                    <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-1.5"></span>
                                    <span>{stats.messagesCount || 0} pesan</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-col space-y-2.5">
                            <button
                              onClick={() => navigate(`/dashboard/${home.id}`)}
                              className="px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-medium transition-all hover:shadow-hard hover:-translate-y-0.5"
                            >
                              Masuk
                            </button>
                            
                            {home.createdBy === currentUser?.uid ? (
                              <>
                                <button
                                  onClick={() => setShowConfirmDialog({
                                    type: 'regenerate',
                                    homeId: home.id,
                                    homeName: home.name
                                  })}
                                  className="px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-yellow-500 to-amber-600 text-white hover:from-yellow-600 hover:to-amber-700 shadow-medium transition-all hover:shadow-hard hover:-translate-y-0.5"
                                >
                                  Kode Baru
                                </button>
                                <button
                                  onClick={() => setShowConfirmDialog({
                                    type: 'delete',
                                    homeId: home.id,
                                    homeName: home.name
                                  })}
                                  className="px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700 shadow-medium transition-all hover:shadow-hard hover:-translate-y-0.5"
                                >
                                  Hapus
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setShowConfirmDialog({
                                  type: 'leave',
                                  homeId: home.id,
                                  homeName: home.name
                                })}
                                className="px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700 shadow-medium transition-all hover:shadow-hard hover:-translate-y-0.5"
                              >
                                Keluar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 glassmorphism border border-red-500/30 text-red-300 px-4 py-3 rounded-xl shadow-medium relative animate-scale-in" role="alert">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="block">{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 glassmorphism border border-green-500/30 text-green-300 px-4 py-3 rounded-xl shadow-medium relative animate-scale-in" role="alert">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="block">{success}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card-modern p-6 shadow-hard animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="mb-4">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center mb-4 shadow-medium">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gradient mb-1">Buat Rumah Baru</h3>
              <p className="text-sm text-gray-400 mb-4">Buat rumah baru untuk diri sendiri dan ajak teman-temanmu</p>
            </div>
            
            <form className="space-y-4" onSubmit={handleCreateHome}>
              <div>
                <label htmlFor="home-name" className="block text-sm font-medium text-gray-300 mb-1">
                  Nama Rumah
                </label>
                <input
                  id="home-name"
                  name="home-name"
                  type="text"
                  className="input-modern"
                  placeholder="Rumah Kita"
                  value={homeName}
                  onChange={(e) => setHomeName(e.target.value)}
                />
              </div>
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full flex justify-center items-center"
                >
                  {loading ? (
                    <>
                      <div className="loading-spinner mr-2"></div>
                      <span>Membuat...</span>
                    </>
                  ) : 'Buat Rumah Baru'}
                </button>
              </div>
            </form>
          </div>

          <div className="card-modern p-6 shadow-hard animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="mb-4">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center mb-4 shadow-medium">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gradient mb-1">Gabung ke Rumah</h3>
              <p className="text-sm text-gray-400 mb-4">Gabung ke rumah yang sudah dibuat teman dengan kode undangan</p>
            </div>
            
            <form className="space-y-4" onSubmit={handleJoinHome}>
              <div>
                <label htmlFor="invite-code" className="block text-sm font-medium text-gray-300 mb-1">
                  Kode Undangan
                </label>
                <input
                  id="invite-code"
                  name="invite-code"
                  type="text"
                  required
                  className="input-modern"
                  placeholder="XXX-XXX-XXX"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                />
              </div>
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-4 py-3 rounded-xl font-medium shadow-medium transition-all hover:shadow-hard hover:-translate-y-0.5"
                >
                  {loading ? (
                    <>
                      <div className="loading-spinner mr-2"></div>
                      <span>Bergabung...</span>
                    </>
                  ) : 'Gabung ke Rumah'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {homes.length === 0 && (
          <div className="mt-12 text-center animate-fade-in">
            <div className="relative">
              <div className="animate-float inline-block" style={{ animationDelay: '0.1s' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-slate-600 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <div className="animate-float absolute top-4 left-16" style={{ animationDelay: '0.3s' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div className="animate-float absolute top-2 right-16" style={{ animationDelay: '0.5s' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-purple-500 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
            </div>
            <p className="mt-4 text-gray-400">Belum ada rumah yang diikuti. Buat baru atau gabung dengan teman!</p>
          </div>
        )}

        <ConfirmDialog />
      </div>
    </div>
  );
};

export default HomeSetup;
