import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import './App.css';

// Auth Components
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import HomeSetup from './components/home/HomeSetup';
import Dashboard from './components/dashboard/Dashboard';

// Context Providers
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';

// Private Route component untuk proteksi halaman
import PrivateRoute from './components/auth/PrivateRoute';

const Navbar: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  
  // Don't show navbar on login/register pages
  if (location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/') {
    return null;
  }

  return (
    <nav className="card-modern mb-6 mx-4 mt-4">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gradient">Rumah Kita</span>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-6">
            <Link 
              to="/dashboard" 
              className="text-slate-300 hover:text-white transition-colors duration-200 font-medium"
            >
              Dashboard
            </Link>
            
            {currentUser && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {currentUser.displayName?.charAt(0) || currentUser.email?.charAt(0)}
                    </span>
                  </div>
                  <span className="text-slate-300 text-sm">
                    {currentUser.displayName || currentUser.email}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="btn-outline text-sm px-4 py-2"
                >
                  Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <Navbar />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard/:homeId" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />
            <Route path="/dashboard" element={
              <PrivateRoute>
                <HomeSetup />
              </PrivateRoute>
            } />
            <Route path="/" element={<Login />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
