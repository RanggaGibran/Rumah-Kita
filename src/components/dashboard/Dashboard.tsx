import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getHomeById } from '../../services/firebase/home';
import { logout } from '../../services/firebase/auth';
import { Home } from '../../types/user';
import Notes from '../notes/Notes';
import Wishlist from '../wishlist/Wishlist';
import Chat from '../chat/Chat';
import VideoCall from '../call/VideoCall';
import HomeSettings from './HomeSettings';

const Dashboard: React.FC = () => {
  const { homeId } = useParams<{ homeId: string }>();
  const [home, setHome] = useState<Home | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
    // Navigation state for different features
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const fetchHomeData = async () => {
      if (!homeId || !currentUser) return;
      
      try {
        const { home, error } = await getHomeById(homeId);
        
        if (error) {
          setError(error);
          return;
        }
        
        if (home) {
          // Verifikasi bahwa user adalah anggota dari rumah ini
          if (!home.members.includes(currentUser.uid)) {
            setError('Anda tidak memiliki akses ke rumah ini');
            navigate('/');
            return;
          }
          
          setHome(home);
        }
      } catch (err: any) {
        setError('Gagal memuat data rumah: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, [homeId, currentUser, navigate]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err: any) {
      setError('Gagal logout: ' + err.message);
    }
  };

  if (!currentUser) {
    navigate('/login');
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation bar */}
      <nav className="bg-indigo-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-white font-bold">Rumah Kita</h1>
              </div>              <div className="hidden md:block">                <div className="ml-10 flex items-baseline space-x-4">
                  <button
                    className={`${
                      activeTab === 'dashboard'
                        ? 'bg-indigo-700 text-white'
                        : 'text-indigo-200 hover:bg-indigo-500'
                    } px-3 py-2 rounded-md text-sm font-medium`}
                    onClick={() => setActiveTab('dashboard')}
                  >
                    Dashboard
                  </button>
                  <button
                    className={`${
                      activeTab === 'notes'
                        ? 'bg-indigo-700 text-white'
                        : 'text-indigo-200 hover:bg-indigo-500'
                    } px-3 py-2 rounded-md text-sm font-medium`}
                    onClick={() => setActiveTab('notes')}
                  >
                    Notes
                  </button>
                  <button
                    className={`${
                      activeTab === 'wishlist'
                        ? 'bg-indigo-700 text-white'
                        : 'text-indigo-200 hover:bg-indigo-500'
                    } px-3 py-2 rounded-md text-sm font-medium`}
                    onClick={() => setActiveTab('wishlist')}
                  >
                    Wishlist
                  </button>
                  <button
                    className={`${
                      activeTab === 'chat'
                        ? 'bg-indigo-700 text-white'
                        : 'text-indigo-200 hover:bg-indigo-500'
                    } px-3 py-2 rounded-md text-sm font-medium`}
                    onClick={() => setActiveTab('chat')}
                  >
                    Chat
                  </button>
                  <button
                    className={`${
                      activeTab === 'call'
                        ? 'bg-indigo-700 text-white'
                        : 'text-indigo-200 hover:bg-indigo-500'
                    } px-3 py-2 rounded-md text-sm font-medium`}
                    onClick={() => setActiveTab('call')}
                  >
                    Panggilan
                  </button>
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="ml-4 flex items-center md:ml-6">
                <div className="ml-3 relative">
                  <div className="flex items-center">
                    {userProfile?.photoURL ? (
                      <img
                        className="h-8 w-8 rounded-full"
                        src={userProfile.photoURL}
                        alt={userProfile.displayName || "User"}
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-indigo-300 flex items-center justify-center">
                        <span className="text-indigo-700 font-medium">
                          {userProfile?.displayName?.charAt(0) || userProfile?.email?.charAt(0) || "U"}
                        </span>
                      </div>
                    )}
                    <span className="ml-2 text-white text-sm">
                      {userProfile?.displayName || userProfile?.email}
                    </span>
                    <button
                      onClick={handleLogout}
                      className="ml-4 px-2 py-1 text-sm text-white bg-indigo-700 rounded hover:bg-indigo-800"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {home && (
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900">{home.name}</h2>
              <p className="text-sm text-gray-500">
                Kode Undangan: <span className="font-medium">{home.inviteCode}</span>
              </p>
            </div>            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="p-6">
                {/* Render component based on active tab */}
                {activeTab === 'dashboard' && home && <HomeSettings home={home} />}
                {activeTab === 'notes' && homeId && <Notes />}
                {activeTab === 'wishlist' && homeId && <Wishlist homeId={homeId} />}
                {activeTab === 'chat' && homeId && <Chat homeId={homeId} />}
                {activeTab === 'call' && homeId && <VideoCall homeId={homeId} />}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
