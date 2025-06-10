import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import './App.css';

// Auth Components
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import HomeSetup from './components/home/HomeSetup';
import Dashboard from './components/dashboard/Dashboard';

// Layout Components
import Navbar from './components/layout/Navbar';

// Context Providers
import { AuthProvider } from './contexts/AuthContext';

// Private Route component untuk proteksi halaman
import PrivateRoute from './components/auth/PrivateRoute';

const AppContent: React.FC = () => {
  const location = useLocation();
  const noNavbarPaths = ['/login', '/register'];
  const showNavbar = !noNavbarPaths.includes(location.pathname);  // Show home tabs if we're in a dashboard with a valid homeId
  // Check if we're on a dashboard route with a valid homeId
  const pathParts = location.pathname.split('/');
  const homeIdInPath = pathParts.length >= 3 ? pathParts[2] : null;
  const showHomeTabs = location.pathname.startsWith('/dashboard/') && 
                      !!homeIdInPath && 
                      homeIdInPath !== 'undefined';

  return (
    <>
      {showNavbar && <Navbar showHomeTabs={showHomeTabs} />}
      <div className={showNavbar ? "pt-0" : ""}> {/* Add padding top if navbar is present */}        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route 
            path="/dashboard/:homeId" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <PrivateRoute>
                <HomeSetup />
              </PrivateRoute>
            } 
          />
          <Route path="/" element={<Login />} />
        </Routes>
      </div>
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <AppContent />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
