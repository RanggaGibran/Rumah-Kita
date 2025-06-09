import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

// Auth Components
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import HomeSetup from './components/home/HomeSetup';
import Dashboard from './components/dashboard/Dashboard';

// Context Providers
import { AuthProvider } from './contexts/AuthContext';

// Private Route component untuk proteksi halaman
import PrivateRoute from './components/auth/PrivateRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          {/* Navbar */}
          <nav className="bg-white shadow mb-4">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <a href="/dashboard" className="text-indigo-600 font-bold text-lg hover:underline">Dashboard</a>
              </div>
            </div>
          </nav>
          {/* End Navbar */}
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard/:homeId" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />            <Route path="/dashboard" element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } />
            // Hapus route HomeSetup yang tidak diperlukan
            <Route path="/" element={<Login />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
