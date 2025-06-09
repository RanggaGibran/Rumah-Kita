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
        
        // Jika user sudah punya rumah, arahkan ke rumah pertama
        if (homes.length > 0) {
          navigate(`/dashboard/${homes[0].id}`);
        }
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
            confirmClass: 'bg-red-600 hover:bg-red-700'
          };
        case 'delete':
          return {
            title: 'Hapus Rumah',
            message: `Apakah Anda yakin ingin menghapus rumah "${homeName}"? Tindakan ini tidak dapat dibatalkan.`,
            confirmText: 'Hapus',
            confirmAction: () => handleDeleteHome(homeId),
            confirmClass: 'bg-red-600 hover:bg-red-700'
          };
        case 'regenerate':
          return {
            title: 'Buat Kode Undangan Baru',
            message: `Apakah Anda yakin ingin membuat kode undangan baru untuk rumah "${homeName}"? Kode lama akan tidak berlaku lagi.`,
            confirmText: 'Buat Baru',
            confirmAction: () => handleRegenerateCode(homeId),
            confirmClass: 'bg-yellow-600 hover:bg-yellow-700'
          };
        default:
          return null;
      }
    };

    const dialogContent = getDialogContent();
    if (!dialogContent) return null;

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <div className="mt-3 text-center">
            <h3 className="text-lg font-medium text-gray-900">{dialogContent.title}</h3>
            <div className="mt-2 px-7 py-3">
              <p className="text-sm text-gray-500">{dialogContent.message}</p>
            </div>
            <div className="flex justify-center space-x-4 px-4 py-3">
              <button
                onClick={() => setShowConfirmDialog(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 text-base font-medium rounded-md shadow-sm hover:bg-gray-400"
              >
                Batal
              </button>
              <button
                onClick={dialogContent.confirmAction}
                disabled={loading}
                className={`px-4 py-2 text-white text-base font-medium rounded-md shadow-sm ${dialogContent.confirmClass}`}
              >
                {loading ? 'Memproses...' : dialogContent.confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900">Silakan login terlebih dahulu</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <h2 className="text-center text-3xl font-extrabold text-gray-900 mb-8">
          Selamat Datang di Rumah Kita
        </h2>
        
        {homes.length > 0 && (
          <div className="mb-8 bg-white shadow overflow-hidden rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Rumah Anda
              </h3>
            </div>            <div className="border-t border-gray-200">
              <ul className="divide-y divide-gray-200">
                {homes.map((home) => {
                  const stats = homeStats[home.id];
                  return (
                    <li key={home.id}>
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-indigo-600 truncate">
                              {home.name}
                            </p>
                            <div className="mt-2 flex items-center text-sm text-gray-500">
                              <span>Kode: {home.inviteCode}</span>
                              {home.createdBy === currentUser?.uid && (
                                <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                  Owner
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-gray-400">
                              <span>{home.members.length} anggota</span>
                              {stats && (
                                <>
                                  <span className="mx-1">•</span>
                                  <span>{stats.notesCount || 0} catatan</span>
                                  <span className="mx-1">•</span>
                                  <span>{stats.wishlistCount || 0} wishlist</span>
                                  <span className="mx-1">•</span>
                                  <span>{stats.messagesCount || 0} pesan</span>
                                </>
                              )}
                            </div>
                          </div>                          <div className="flex flex-col space-y-2 ml-4">
                            <button
                              onClick={() => navigate(`/dashboard/${home.id}`)}
                              className="px-3 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800 hover:bg-indigo-200"
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
                                  className="px-3 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                                >
                                  Kode Baru
                                </button>
                                <button
                                  onClick={() => setShowConfirmDialog({
                                    type: 'delete',
                                    homeId: home.id,
                                    homeName: home.name
                                  })}
                                  className="px-3 py-1 rounded text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200"
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
                                className="px-3 py-1 rounded text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200"
                              >
                                Keluar
                              </button>
                            )}                          </div>
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
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{success}</span>
          </div>
        )}

        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-8 divide-y divide-gray-200">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Buat Rumah Baru</h3>
              <form className="mt-4 space-y-4" onSubmit={handleCreateHome}>
                <div>
                  <label htmlFor="home-name" className="block text-sm font-medium text-gray-700">
                    Nama Rumah
                  </label>
                  <div className="mt-1">
                    <input
                      id="home-name"
                      name="home-name"
                      type="text"
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="Rumah Kita"
                      value={homeName}
                      onChange={(e) => setHomeName(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    {loading ? 'Membuat...' : 'Buat Rumah Baru'}
                  </button>
                </div>
              </form>
            </div>

            <div className="pt-6">
              <h3 className="text-lg font-medium text-gray-900">Gabung ke Rumah yang Sudah Ada</h3>
              <form className="mt-4 space-y-4" onSubmit={handleJoinHome}>
                <div>
                  <label htmlFor="invite-code" className="block text-sm font-medium text-gray-700">
                    Kode Undangan
                  </label>
                  <div className="mt-1">
                    <input
                      id="invite-code"
                      name="invite-code"
                      type="text"
                      required
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="XXX-XXX-XXX"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    {loading ? 'Bergabung...' : 'Gabung ke Rumah'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <ConfirmDialog />
      </div>
    </div>
  );
};

export default HomeSetup;
