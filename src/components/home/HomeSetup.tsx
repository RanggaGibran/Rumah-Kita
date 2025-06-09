import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { createHome, joinHomeByInviteCode, getUserHomes } from '../../services/firebase/home';
import { Home } from '../../types/user';

const HomeSetup: React.FC = () => {
  const [homeName, setHomeName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [homes, setHomes] = useState<Home[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
            </div>
            <div className="border-t border-gray-200">
              <ul className="divide-y divide-gray-200">
                {homes.map((home) => (
                  <li key={home.id}>
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-indigo-600 truncate">
                          {home.name}
                        </p>
                        <button
                          onClick={() => navigate(`/dashboard/${home.id}`)}
                          className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                        >
                          Masuk
                        </button>
                      </div>
                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex">
                          <p className="flex items-center text-sm text-gray-500">
                            Kode: {home.inviteCode}
                          </p>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
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
      </div>
    </div>
  );
};

export default HomeSetup;
