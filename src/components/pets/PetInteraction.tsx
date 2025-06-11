import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { Pet, PetInteraction } from '../../types/pet';
import { PetInteractionType } from '../../types/pet';
import { 
  interactWithPet,
  getPetInteractions,
  subscribeToPetInteractions,
  deletePet
} from '../../services/firebase/pets';

interface PetInteractionProps {
  pet: Pet;
  onClose: () => void;
}

const PetInteractionComponent: React.FC<PetInteractionProps> = ({ pet, onClose }) => {
  const [message, setMessage] = useState('');
  const [interactions, setInteractions] = useState<PetInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isInteracting, setIsInteracting] = useState(false);
  const [interactionType, setInteractionType] = useState<PetInteractionType | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { currentUser } = useAuth();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Add effect to prevent scrolling when modal is open
  useEffect(() => {
    // Save the original overflow style
    const originalStyle = window.getComputedStyle(document.body).overflow;
    // Prevent scrolling on the background
    document.body.style.overflow = 'hidden';
    
    // Restore original overflow when component unmounts
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);  // Subscribe to interactions for this pet
  useEffect(() => {
    if (!pet.id) return;
    
    // Set loading state initially
    setLoading(true);
    
    // Create a cleanup function variable
    let unsubscribeFunc: (() => void) | undefined;
    
    try {
      // Use the subscribeToPetInteractions function
      unsubscribeFunc = subscribeToPetInteractions(
        pet.id,
        (interactionsData) => {
          setInteractions(interactionsData);
          setLoading(false);
        },
        10 // limit to 10 interactions
      );
    } catch (error: any) {
      console.error("Error subscribing to pet interactions:", error);
      setError(`Error loading interactions: ${error.message}`);
      setLoading(false);
    }
    
    // Return cleanup function
    return () => {
      if (typeof unsubscribeFunc === 'function') {
        unsubscribeFunc();
      }
    };
  }, [pet.id]);

  // Scroll to bottom of interactions whenever they update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interactions]);

  const handleDeletePet = async () => {
    if (!currentUser || !pet.id) return;
    
    setIsDeleting(true);
    setError('');
    
    try {
      const { success, error: deleteError } = await deletePet(pet.id);
      
      if (!success || deleteError) {
        setError(deleteError || 'Terjadi kesalahan saat menghapus peliharaan');
        setIsDeleting(false);
      } else {
        // Close the modal and refresh pets list
        onClose();
      }
    } catch (err: any) {
      setError(`Terjadi kesalahan: ${err.message || 'Unknown error'}`);
      setIsDeleting(false);
    }
  };
  
  const handleInteraction = async (type: PetInteractionType) => {
    if (!currentUser) return;
    
    setInteractionType(type);
    setIsInteracting(true);
    setError('');
    
    try {
      // Only include message for "talk" interactions
      const messageToSend = type === 'talk' ? message.trim() : undefined;
      
      const { success, error: interactionError, response } = await interactWithPet(
        pet.id, 
        currentUser.uid, 
        type, 
        messageToSend
      );
      
      if (interactionError || !success) {
        setError(interactionError || 'Terjadi kesalahan saat berinteraksi');
      } else {
        // Reset message input after talking
        if (type === 'talk') {
          setMessage('');
        }
      }
    } catch (err: any) {
      setError('Terjadi kesalahan: ' + err.message);
    } finally {
      setIsInteracting(false);
      setInteractionType(null);
    }
  };

  const getPetEmoji = (type: Pet["type"]) => {
    switch (type) {
      case 'dog': return '🐶';
      case 'cat': return '🐱';
      case 'bird': return '🐦';
      case 'rabbit': return '🐰';
      case 'fish': return '🐠';
      case 'hamster': return '🐹';
      case 'turtle': return '🐢';
      default: return '🐾';
    }
  };
  
  const getMoodEmoji = (mood: Pet["mood"]) => {
    switch (mood) {
      case 'happy': return '😄';
      case 'content': return '🙂';
      case 'neutral': return '😐';
      case 'sad': return '😢';
      case 'angry': return '😠';
      default: return '😐';
    }
  };
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInteractionEmoji = (type: PetInteractionType) => {
    switch (type) {
      case 'feed': return '🍖';
      case 'clean': return '🧹';
      case 'play': return '🎾';
      case 'pet': return '✋';
      case 'talk': return '💬';
      default: return '❓';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center animate-fade-in">
      <div className="relative mx-auto p-6 w-full max-w-2xl card-modern shadow-hard" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        {error && (
          <div className="p-4 mb-4 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        
        {/* Pet header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl">
              {getPetEmoji(pet.type)}
            </div>
            <div className="ml-3">
              <h2 className="text-xl font-semibold text-gradient bg-gradient-to-r from-orange-400 to-amber-500">
                {pet.name}
              </h2>
              <p className="text-sm text-slate-400">
                {pet.personality} {pet.type}
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="text-slate-400 hover:text-red-400 transition-smooth p-1 rounded-full hover:bg-slate-700/50"
              aria-label="Delete pet"
              title="Hapus peliharaan"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button 
              className="text-slate-400 hover:text-white transition-smooth p-1 rounded-full hover:bg-slate-700/50"
              onClick={onClose}
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Pet stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <span className="text-slate-300">Status: </span>
            <span className="ml-1">
              {pet.mood === 'happy' || pet.mood === 'content' ? 'Baik & Senang' : 
               pet.mood === 'neutral' ? 'Biasa saja' : 
               'Butuh perhatian'}
            </span>
          </div>
          <div>
            <span className="text-slate-300">Energi: </span>
            <span className={`ml-1 ${pet.energy < 30 ? 'text-red-400' : ''}`}>
              {pet.energy}/100
            </span>
          </div>
          <div>
            <span className="text-slate-300">Terakhir diberi makan: </span>
            <span className={`ml-1 ${
              (new Date().getTime() - pet.lastFed.getTime()) / (1000 * 60 * 60) > 24 
                ? 'text-red-400' 
                : ''
            }`}>
              {pet.lastFed.toLocaleDateString('id-ID')} {formatTime(pet.lastFed)}
            </span>
          </div>
        </div>
        
        {/* Interactions History */}
        <div className="flex-1 overflow-y-auto mb-4 bg-slate-900/30 rounded-lg p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-4 border-t-transparent border-blue-500 rounded-full animate-spin"></div>
              <span className="ml-3 text-slate-400">Memuat interaksi...</span>
            </div>
          ) : interactions.length === 0 ? (
            <div className="text-center p-6 text-slate-400">
              <p>Belum ada interaksi dengan {pet.name}</p>
              <p className="text-sm mt-2">Mulai berinteraksi untuk membentuk ikatan</p>
            </div>
          ) : (
            <div className="space-y-3">
              {interactions.map((interaction) => (
                <div key={interaction.id} className="glassmorphism bg-slate-800/30 p-3 rounded-lg shadow-soft">
                  <div className="flex items-start">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-xl">
                      {getInteractionEmoji(interaction.type)}
                    </div>
                    <div className="ml-3 flex-1">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>
                          {new Date(interaction.timestamp).toLocaleDateString('id-ID')} {formatTime(new Date(interaction.timestamp))}
                        </span>
                        <span className="capitalize">{interaction.type}</span>
                      </div>
                      
                      {interaction.message && (
                        <div className="mt-1.5 p-2 bg-indigo-900/20 border border-indigo-800/30 rounded-lg text-sm text-slate-300">
                          {interaction.message}
                        </div>
                      )}
                      
                      {interaction.response && (
                        <div className="mt-2 flex">
                          <div className="w-6 h-6 flex-shrink-0 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xs">
                            {getPetEmoji(pet.type)}
                          </div>
                          <div className="ml-2 p-2 bg-gradient-to-r from-amber-900/10 to-orange-900/10 border border-amber-700/20 rounded-lg text-sm text-amber-100/90 flex-1">
                            {interaction.response}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        
        {/* Interaction Controls */}
        <div className="border-t border-slate-700/30 pt-4">
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => handleInteraction('feed')}
              disabled={isInteracting}
              className={`px-3 py-2 rounded-md text-sm flex items-center ${
                isInteracting && interactionType === 'feed'
                  ? 'bg-amber-600/50 text-white disabled:opacity-70'
                  : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500 disabled:opacity-50'
              }`}
            >
              <span className="text-lg mr-1.5">🍖</span>
              {isInteracting && interactionType === 'feed' ? (
                <span className="flex items-center">
                  <div className="w-3 h-3 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-2"></div>
                  Memberi makan...
                </span>
              ) : 'Beri makan'}
            </button>
            
            <button
              onClick={() => handleInteraction('clean')}
              disabled={isInteracting}
              className={`px-3 py-2 rounded-md text-sm flex items-center ${
                isInteracting && interactionType === 'clean'
                  ? 'bg-green-600/50 text-white disabled:opacity-70'
                  : 'bg-gradient-to-r from-green-600 to-teal-600 text-white hover:from-green-500 hover:to-teal-500 disabled:opacity-50'
              }`}
            >
              <span className="text-lg mr-1.5">🧹</span>
              {isInteracting && interactionType === 'clean' ? (
                <span className="flex items-center">
                  <div className="w-3 h-3 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-2"></div>
                  Membersihkan...
                </span>
              ) : 'Bersihkan'}
            </button>
            
            <button
              onClick={() => handleInteraction('play')}
              disabled={isInteracting}
              className={`px-3 py-2 rounded-md text-sm flex items-center ${
                isInteracting && interactionType === 'play'
                  ? 'bg-blue-600/50 text-white disabled:opacity-70'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50'
              }`}
            >
              <span className="text-lg mr-1.5">🎾</span>
              {isInteracting && interactionType === 'play' ? (
                <span className="flex items-center">
                  <div className="w-3 h-3 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-2"></div>
                  Bermain...
                </span>
              ) : 'Bermain'}
            </button>
            
            <button
              onClick={() => handleInteraction('pet')}
              disabled={isInteracting}
              className={`px-3 py-2 rounded-md text-sm flex items-center ${
                isInteracting && interactionType === 'pet'
                  ? 'bg-purple-600/50 text-white disabled:opacity-70'
                  : 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-50'
              }`}
            >
              <span className="text-lg mr-1.5">✋</span>
              {isInteracting && interactionType === 'pet' ? (
                <span className="flex items-center">
                  <div className="w-3 h-3 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-2"></div>
                  Membelai...
                </span>
              ) : 'Belai'}
            </button>
          </div>
          
          {/* Talk interaction */}
          <div className="flex space-x-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Bicara dengan ${pet.name}...`}
              className="flex-1 input-modern shadow-soft focus:ring-2 focus:ring-blue-500/50"
              disabled={isInteracting}
            />
            <button
              onClick={() => handleInteraction('talk')}
              disabled={isInteracting || !message.trim()}
              className={`px-4 py-2 rounded-md text-sm flex items-center whitespace-nowrap ${
                isInteracting && interactionType === 'talk'
                  ? 'bg-slate-600/50 text-white disabled:opacity-70'
                  : 'bg-gradient-to-r from-slate-600 to-slate-700 text-white hover:from-slate-500 hover:to-slate-600 disabled:opacity-50'
              }`}
            >
              {isInteracting && interactionType === 'talk' ? (
                <span className="flex items-center">
                  <div className="w-3 h-3 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-2"></div>
                  Bicara...
                </span>
              ) : (
                <>
                  <span className="text-lg mr-1.5">💬</span>
                  Bicara
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Delete confirmation dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 flex items-center justify-center z-[10000]">
            <div className="bg-slate-800/90 p-6 rounded-lg shadow-lg max-w-sm w-full">
              <h3 className="text-lg font-semibold mb-4 text-white">
                Hapus Peliharaan
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                Apakah Anda yakin ingin menghapus peliharaan ini? Tindakan ini tidak dapat dibatalkan.
              </p>
              
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 rounded-md text-sm bg-slate-700 hover:bg-slate-600 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleDeletePet}
                  disabled={isDeleting}
                  className={`px-4 py-2 rounded-md text-sm flex items-center ${
                    isDeleting ? 'bg-red-600/50 text-white disabled:opacity-70' : 'bg-red-600 text-white hover:bg-red-500'
                  }`}
                >
                  {isDeleting ? (
                    <span className="flex items-center">
                      <div className="w-3 h-3 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-2"></div>
                      Menghapus...
                    </span>
                  ) : (
                    'Hapus Peliharaan'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}      </div>
      
      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 z-[10000] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-red-500/30 rounded-lg shadow-xl p-6 max-w-md w-full animate-fade-in-up">
            <h3 className="text-lg font-semibold mb-2 text-white">Hapus Peliharaan</h3>
            <p className="text-slate-300 mb-4">
              Apakah Anda yakin ingin menghapus {pet.name}? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary text-sm px-4 py-2"
                disabled={isDeleting}
              >
                Batal
              </button>
              <button
                onClick={handleDeletePet}
                className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-md shadow transition-colors disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <span className="flex items-center">
                    <div className="w-3 h-3 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-2"></div>
                    Menghapus...
                  </span>
                ) : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Fix the default export
export default PetInteractionComponent;
