import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getHomeById } from '../../services/firebase/home';
import { Home, TabType } from '../../types'; // Import TabType
import Notes from '../notes/Notes';
import Wishlist from '../wishlist/Wishlist';
import Chat from '../chat/Chat';
import VideoCall from '../call/VideoCall';
import HomeSettings from './HomeSettings';

const Dashboard: React.FC = () => {
  const { homeId } = useParams<{ homeId?: string }>(); // homeId can be undefined
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [home, setHome] = useState<Home | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleTabChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      // Ensure the event is from navbar to avoid loops if Dashboard also emits tabchange
      if (customEvent.detail && customEvent.detail.tab) {
        setActiveTab(customEvent.detail.tab);
      }
    };
    
    window.addEventListener('tabchange', handleTabChange);
    
    return () => {
      window.removeEventListener('tabchange', handleTabChange);
    };
  }, []);

  useEffect(() => {
    const fetchHomeData = async () => {
      if (!homeId || homeId === 'undefined' || !currentUser) {
        setError('ID rumah tidak valid atau sesi tidak ditemukan.');
        setLoading(false);
        navigate('/dashboard');
        return;
      }

      setLoading(true);
      try {
        const { home, error } = await getHomeById(homeId);
        if (error) {
          setError(error);
          setLoading(false);
          return;
        }
        if (home) {
          if (!home.members.includes(currentUser.uid)) {
            setError('Anda tidak memiliki akses ke rumah ini');
            navigate('/dashboard');
            setLoading(false);
            return;
          }
          setHome(home);
        } else {
          setError('Rumah tidak ditemukan.');
          navigate('/dashboard');
        }
      } catch (err: any) {
        setError('Gagal memuat data rumah: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, [homeId, currentUser, navigate]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // Optionally, if Navbar needs to be informed of Dashboard-initiated tab changes (e.g. mobile tabs)
    const tabEvent = new CustomEvent('tabchange', { 
      detail: { tab, source: 'dashboard' } 
    });
    window.dispatchEvent(tabEvent);
  };

  if (!currentUser) {
    navigate('/login');
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  // If there's a homeId but no home loaded (and not loading, and no error that caused navigation)
  if (homeId && homeId !== "undefined" && !home && !loading && !error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-300 p-4">
        <svg className="mx-auto h-12 w-12 text-slate-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.79 4 4s-1.79 4-4 4c-1.742 0-3.223-.835-3.772-2M21 12H3" />
        </svg>
        <h3 className="mt-2 text-lg font-medium">Memuat data rumah...</h3>
        <p className="mt-1 text-sm text-slate-400">
          Jika pesan ini tidak hilang, coba kembali ke <Link to="/dashboard" className="text-purple-400 hover:text-purple-300 font-medium">pemilihan rumah</Link>.
        </p>
      </div>
    );
  }
  
  // If no homeId is present in the URL (e.g. /dashboard route), show HomeSetup or a selection component
  if (!homeId || homeId === "undefined") {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-300 p-4">
            <svg className="mx-auto h-16 w-16 text-purple-500 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <h1 className="text-3xl font-bold text-white mb-3">Selamat Datang di Rumah Kita</h1>
            <p className="text-lg text-slate-400 mb-8 max-w-md text-center">
                Pilih rumah yang sudah ada atau buat rumah baru untuk memulai.
            </p>
            <div className="space-y-4 sm:space-y-0 sm:flex sm:space-x-4">
                <Link 
                    to="/home-select" // Assuming you have a route for home selection
                    className="w-full sm:w-auto flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 transition-colors duration-150 ease-in-out"
                >
                    Pilih Rumah
                </Link>
                <Link 
                    to="/home-setup" // Assuming you have a route for creating a new home
                    className="w-full sm:w-auto flex items-center justify-center px-6 py-3 border border-purple-500 text-base font-medium rounded-md text-purple-300 bg-slate-800 hover:bg-slate-700 hover:text-purple-200 transition-colors duration-150 ease-in-out"
                >
                    Buat Rumah Baru
                </Link>
            </div>
        </div>
    );
  }

  return (
    <div className="bg-slate-900 text-slate-200 min-h-[calc(100vh-4rem)]">
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg animate-scale-in" role="alert">
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">{error}</span>
            </div>
          </div>
        )}
        {home && (
          <div className="px-4 py-6 sm:px-0">
            {activeTab === 'dashboard' && (
              <div className="mb-8">
                <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-sm border border-purple-500/20 rounded-xl p-8 mb-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
                        </svg>
                      </div>
                      <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                          {home.name}
                        </h1>
                        <p className="text-slate-400 mt-1">
                          {home.members.length} anggota rumah
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400 mb-2">Kode Undangan</p>
                      <div className="bg-slate-700/50 border border-purple-500/30 rounded-lg px-4 py-2">
                        <span className="font-mono text-lg text-purple-300">{home.inviteCode}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="md:hidden mb-6 flex overflow-x-auto space-x-2">
              <button
                onClick={() => handleTabChange('dashboard')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'dashboard' ? 'bg-purple-600 text-white' : 'bg-slate-700/50 hover:bg-slate-700'}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => handleTabChange('notes')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'notes' ? 'bg-purple-600 text-white' : 'bg-slate-700/50 hover:bg-slate-700'}`}
              >
                Notes
              </button>
              <button
                onClick={() => handleTabChange('wishlist')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'wishlist' ? 'bg-purple-600 text-white' : 'bg-slate-700/50 hover:bg-slate-700'}`}
              >
                Wishlist
              </button>
              <button
                onClick={() => handleTabChange('chat')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'chat' ? 'bg-purple-600 text-white' : 'bg-slate-700/50 hover:bg-slate-700'}`}
              >
                Chat
              </button>
              <button
                onClick={() => handleTabChange('call')}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'call' ? 'bg-purple-600 text-white' : 'bg-slate-700/50 hover:bg-slate-700'}`}
              >
                Panggilan
              </button>
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-xl overflow-hidden">
              <div className="p-8">
                {activeTab === 'dashboard' && home && <HomeSettings home={home} />}
                {activeTab === 'notes' && homeId && <Notes />}
                {activeTab === 'wishlist' && homeId && <Wishlist homeId={homeId} />}
                {activeTab === 'chat' && homeId && <Chat homeId={homeId} />}
                {activeTab === 'call' && homeId && <VideoCall homeId={homeId} />}
              </div>
            </div>
          </div>
        )}
        {/* Fallback for when no home is loaded, not loading, and no specific error message shown */}
        {/* This condition might need refinement based on exact states */}
        {!home && !loading && !error && homeId && homeId !== "undefined" && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422A12.083 12.083 0 0112 21a12.083 12.083 0 01-6.16-10.422L12 14z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.06 7.593A9.028 9.028 0 002.03 12c0 4.97 4.03 9 9 9a9.028 9.028 0 006.94-3.593" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-slate-300">Tidak ada data rumah.</h3>
            <p className="mt-1 text-sm text-slate-400">
              Pastikan Anda telah memilih rumah yang benar atau coba lagi.
            </p>
            <Link to="/dashboard" className="mt-4 inline-block px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700">
              Kembali ke Pemilihan Rumah
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
