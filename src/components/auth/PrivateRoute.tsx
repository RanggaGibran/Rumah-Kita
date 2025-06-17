import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface PrivateRouteProps {
  children: React.ReactNode;
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { currentUser, loading } = useAuth();
    // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="relative">
          <div className="w-16 h-16 border-t-4 border-b-4 border-sky-500 rounded-full animate-spin"></div>
          <div className="w-16 h-16 border-r-4 border-l-4 border-sky-300 rounded-full animate-spin absolute top-0 left-0" style={{animationDuration: '1.5s'}}></div>
        </div>
        <p className="text-sky-300 mt-6 font-medium animate-pulse">Menyiapkan Rumah Kita...</p>
        <div className="mt-12 flex space-x-2">
          <div className="w-2 h-2 bg-sky-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-sky-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          <div className="w-2 h-2 bg-sky-300 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
        </div>
      </div>
    );
  }
  
  // Redirect to login if not authenticated
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
    // Render children if authenticated
  return <div className="page-transition">{children}</div>;
};

export default PrivateRoute;
