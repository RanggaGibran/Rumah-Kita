import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserHomes } from '../services/firebase/home';

/**
 * A custom hook to handle redirecting users to their first home
 * when they are authenticated and have at least one home
 */
export const useHomeRedirect = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const checkAndRedirectToHome = async () => {
      if (!currentUser) return;
      
      // Only run this if we're on the login, register, root, or base dashboard page
      const currentPath = window.location.pathname;
      const shouldCheckForRedirect = ['/', '/login', '/register', '/dashboard'].includes(currentPath);
      
      if (!shouldCheckForRedirect) return;
      
      try {
        setLoading(true);
        const { homes, error } = await getUserHomes(currentUser.uid);
        if (error) {
          console.error('Error fetching homes:', error);
          return;
        }
        
        if (homes && homes.length > 0) {
          // Redirect only if we're on basic routes and user has homes
          navigate(`/dashboard/${homes[0].id}`);
        } else if (currentPath !== '/dashboard') {
          // If no homes and not on dashboard, send to dashboard to create one
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Error in home redirect:', error);
      } finally {
        setLoading(false);
      }
    };
    
    checkAndRedirectToHome();
  }, [currentUser, navigate]);
  
  return { loading };
};
