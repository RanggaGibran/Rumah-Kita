import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { logout } from '../../services/firebase/auth';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { TabType } from '../../types'; // Import TabType

const Logo = () => (
  // A simple placeholder SVG logo. Replace with your actual logo.
  <svg className="h-8 w-auto text-sky-500" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
  </svg>
);

interface NavbarProps {
  showHomeTabs: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ showHomeTabs }) => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const { homeId } = useParams<{ homeId?: string }>(); // homeId can be undefined
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Initialize activeTab based on a potential URL hash or default to 'dashboard'
  // This local activeTab is primarily for styling the Navbar itself.
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // We don't need to check this explicitly since showHomeTabs already includes this check
  // Using the prop directly since this logic is now centralized in App.tsx
  const isValidHomeId = showHomeTabs;

  // Effect to listen to tab changes from Dashboard (e.g., mobile tab clicks)
  // to keep Navbar's active state in sync with the Dashboard
  useEffect(() => {
    const handleExternalTabChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.tab && customEvent.detail.source === 'dashboard') {
        setActiveTab(customEvent.detail.tab);
      }
    };
    window.addEventListener('tabchange', handleExternalTabChange);
    return () => {
      window.removeEventListener('tabchange', handleExternalTabChange);
    };
  }, []);


  // Helper function to get nav link classes
  const getNavLinkClass = (tabName: TabType) => {
    const baseClass = "px-3 py-2 rounded-md text-sm font-medium transition-colors";
    const activeClass = "bg-gray-700 text-white";
    const inactiveClass = "text-gray-300 hover:bg-gray-700 hover:text-white"; // Ensure text-gray-300 for inactive
    
    return `${baseClass} ${activeTab === tabName ? activeClass : inactiveClass}`;
  };

  // Helper function to get mobile nav link classes
  const getMobileNavLinkClass = (tabName: TabType) => {
    const baseClass = "block px-3 py-2 rounded-md text-base font-medium transition-colors";
    const activeClass = "bg-gray-700 text-white";
    const inactiveClass = "text-gray-300 hover:bg-gray-700 hover:text-white"; // Ensure text-gray-300 for inactive
    
    return `${baseClass} ${activeTab === tabName ? activeClass : inactiveClass}`;
  };
  // Handle tab click - updates active tab and dispatches event
  const handleTabClick = (tab: TabType, event?: React.MouseEvent) => {
    event?.preventDefault();
    setActiveTab(tab); // Set local navbar active tab for styling
    
    // Dispatch event for Dashboard.tsx to pick up
    const tabEvent = new CustomEvent('tabchange', { 
      detail: { tab, source: 'navbar' } 
    });
    window.dispatchEvent(tabEvent);
    
    // If mobile menu is open, close it
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err: any) {
      console.error('Gagal logout:', err.message);
    }
  };

  return (
    <nav className="bg-gray-900 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Branding */}
          <div className="flex items-center">
            {/* Conditional Link for Logo/Brand */}
            <Link 
              to={isValidHomeId ? `/dashboard/${homeId}` : "/dashboard"} 
              onClick={(e) => {
                if (isValidHomeId) {
                  // If inside a home, clicking logo/brand should set tab to 'dashboard'
                  handleTabClick('dashboard'); 
                }
              }}
              className="flex-shrink-0 flex items-center"
            >
              <Logo />
              <span className="ml-3 text-2xl font-bold tracking-tight">Rumah Kita</span>
            </Link>
          </div>
            {/* Navigation Links - Centered */}
          <div className="hidden md:flex flex-grow items-center justify-center space-x-1 lg:space-x-2 xl:space-x-4">
            {/* Main Dashboard Link */}
            {isValidHomeId ? (
              <button
                type="button"
                onClick={(e) => handleTabClick('dashboard', e)}
                className={getNavLinkClass('dashboard')}
              >
                Dashboard
              </button>
            ) : (
              <Link 
                to="/dashboard" 
                className={getNavLinkClass('dashboard')}
                onClick={() => setActiveTab('dashboard')} // Set active tab for styling on direct nav
              >
                Dashboard
              </Link>
            )}

            {showHomeTabs && (
              <>
                <button type="button" onClick={(e) => handleTabClick('notes', e)} className={getNavLinkClass('notes')}>Notes</button>
                <button type="button" onClick={(e) => handleTabClick('wishlist', e)} className={getNavLinkClass('wishlist')}>Wishlist</button>
                <button type="button" onClick={(e) => handleTabClick('call', e)} className={getNavLinkClass('call')}>Komunikasi</button>
                <button type="button" onClick={(e) => handleTabClick('pets', e)} className={getNavLinkClass('pets')}>Pets</button>
                <button type="button" onClick={(e) => handleTabClick('chat', e)} className={getNavLinkClass('chat')}>Chat</button>
              </>
            )}
          </div>

          {/* User Info and Logout / Login Link */}
          <div className="hidden md:flex items-center space-x-4">
            {currentUser ? (
              <div className="flex items-center space-x-3">                
                <div className="text-sm text-gray-300">
                  <span className="mr-1">Halo,</span>
                  <span className="font-semibold">{userProfile?.displayName || currentUser.email?.split('@')[0] || 'Pengguna'}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 rounded-md text-sm font-medium bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900 text-white transition duration-150 ease-in-out"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-3 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition duration-150 ease-in-out"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            >
              <span className="sr-only">{isMobileMenuOpen ? 'Close menu' : 'Open menu'}</span>
              {isMobileMenuOpen ? (
                <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu, show/hide based on state */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-gray-900 border-t border-gray-700">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {/* Mobile Dashboard Link */}
            {isValidHomeId ? (
              <button
                type="button"
                onClick={(e) => handleTabClick('dashboard', e)}
                className={getMobileNavLinkClass('dashboard')}
              >
                Dashboard
              </button>
            ) : (
              <Link
                to="/dashboard"
                className={getMobileNavLinkClass('dashboard')}
                onClick={() => {
                  setActiveTab('dashboard');
                  setIsMobileMenuOpen(false);
                }}
              >
                Dashboard
              </Link>
            )}
              {showHomeTabs && (
                <>
                  <button type="button" onClick={(e) => handleTabClick('notes', e)} className={getMobileNavLinkClass('notes')}>Notes</button>
                  <button type="button" onClick={(e) => handleTabClick('wishlist', e)} className={getMobileNavLinkClass('wishlist')}>Wishlist</button>
                  <button type="button" onClick={(e) => handleTabClick('call', e)} className={getMobileNavLinkClass('call')}>Komunikasi</button>
                  <button type="button" onClick={(e) => handleTabClick('pets', e)} className={getMobileNavLinkClass('pets')}>Pets</button>
                  <button type="button" onClick={(e) => handleTabClick('chat', e)} className={getMobileNavLinkClass('chat')}>Chat</button>
                </>
              )}
            {/* Mobile Auth Links */}
            {currentUser ? (
              <button
                onClick={() => {
                  handleLogout();
                  setIsMobileMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-red-700 hover:text-white"
              >
                Logout ({userProfile?.displayName || currentUser.email?.split('@')[0] || 'Pengguna'})
              </button>
            ) : (
              <Link
                to="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:bg-blue-700 hover:text-white"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
