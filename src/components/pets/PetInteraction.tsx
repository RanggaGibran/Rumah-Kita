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
  }, []);  

  // Subscribe to interactions for this pet
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
        15 // limit to 15 interactions
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

  // Calculate how many hours since last fed
  const hoursSinceLastFed = () => {
    const hours = (new Date().getTime() - pet.lastFed.getTime()) / (1000 * 60 * 60);
    return Math.floor(hours);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xl animate-fade-in">
      {/* Main Modal Container - Modern, borderless, immersive */}
      <div className="relative w-full max-w-3xl mx-auto flex flex-col rounded-3xl shadow-hard bg-gradient-to-br from-slate-900/90 to-slate-950/95 animate-scale-in overflow-hidden" style={{ maxHeight: '92vh', height: '88vh' }}>
        {/* Header - gradient, more open, improved buttons */}
        <div className="flex items-center justify-between px-8 pt-7 pb-4 bg-gradient-to-r from-indigo-900/60 to-violet-900/40">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-4xl shadow-lg animate-float">
              {getPetEmoji(pet.type)}
            </div>
            <div>
              <h2 className="text-3xl font-extrabold bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent drop-shadow-lg mb-1">
                {pet.name}
              </h2>
              <div className="flex items-center gap-2 text-base text-slate-300/90">
                <span className="capitalize font-medium">{pet.type}</span>
                <span className="mx-1.5">•</span>
                <span>{pet.personality}</span>
                <span className="ml-2 text-2xl">{getMoodEmoji(pet.mood)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="text-slate-400 hover:text-red-400 transition-smooth p-2 rounded-full hover:bg-red-500/10 focus-ring"
              aria-label="Delete pet"
              title="Hapus peliharaan"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button 
              className="text-slate-400 hover:text-white transition-smooth p-2 rounded-full hover:bg-slate-700/50 focus-ring"
              onClick={onClose}
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Pet stats - more open, less boxy, visually distinct */}
        <div className="grid grid-cols-3 gap-6 px-8 pt-4 pb-2">
          <div className="flex flex-col gap-2 bg-gradient-to-br from-slate-800/60 to-slate-900/60 rounded-xl p-4 shadow-soft">
            <span className="text-xs text-slate-400">Energi</span>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-300 ${
                  pet.energy > 75 ? 'bg-gradient-to-r from-green-400 to-green-300' : 
                  pet.energy > 50 ? 'bg-gradient-to-r from-lime-400 to-lime-300' : 
                  pet.energy > 25 ? 'bg-gradient-to-r from-yellow-400 to-yellow-300' : 
                  'bg-gradient-to-r from-red-600 to-red-400'}`} 
                  style={{ width: `${pet.energy}%` }}></div>
              </div>
              <span className={`text-sm font-bold ${
                pet.energy > 75 ? 'text-green-400' : 
                pet.energy > 50 ? 'text-lime-400' : 
                pet.energy > 25 ? 'text-yellow-400' : 
                'text-red-400'
              }`}>{pet.energy}/100</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 bg-gradient-to-br from-slate-800/60 to-slate-900/60 rounded-xl p-4 shadow-soft items-center">
            <span className="text-xs text-slate-400 mb-1">Mood</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getMoodEmoji(pet.mood)}</span>
              <span className="text-base capitalize text-slate-200 font-medium">{pet.mood}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 bg-gradient-to-br from-slate-800/60 to-slate-900/60 rounded-xl p-4 shadow-soft items-center">
            <span className="text-xs text-slate-400 mb-1">Terakhir Diberi Makan</span>
            <div className="flex items-center gap-2">
              <span className="text-lg">🕒</span>
              <span className={`text-sm font-medium ${
                hoursSinceLastFed() > 24 ? 'text-red-400' : 
                hoursSinceLastFed() > 12 ? 'text-yellow-400' : 
                'text-slate-200'
              }`}>
                {hoursSinceLastFed() > 24 ? 
                  `${Math.floor(hoursSinceLastFed() / 24)}d ${hoursSinceLastFed() % 24}h lalu` : 
                  hoursSinceLastFed() > 0 ?
                  `${hoursSinceLastFed()}h lalu` :
                  'Baru saja'}
              </span>
            </div>
          </div>
        </div>

        {/* Interactions History - more open, less boxy, visually appealing */}
        <div className="flex-1 overflow-y-auto px-8 py-5" style={{ minHeight: '250px' }}>
          <h3 className="text-xs uppercase text-slate-500 mb-4 tracking-wider font-semibold">Riwayat Interaksi</h3>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <div className="w-10 h-10 border-4 border-t-transparent border-indigo-500 rounded-full animate-spin mb-3"></div>
              <span>Memuat interaksi...</span>
            </div>
          ) : interactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 bg-slate-800/30 rounded-2xl p-8">
              <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-3">
                <span className="text-3xl">🐾</span>
              </div>
              <p className="text-center text-base font-medium">Belum ada interaksi dengan {pet.name}</p>
              <p className="text-center text-sm mt-2 text-slate-500">Mulai berinteraksi untuk membentuk ikatan</p>
            </div>
          ) : (
            <div className="space-y-5">
              {interactions.map((interaction) => (
                <div key={interaction.id} className="bg-gradient-to-r from-slate-800/40 to-slate-900/30 backdrop-blur-md p-5 rounded-2xl shadow-soft hover:shadow-medium transition-all">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-2xl flex-shrink-0 shadow-inner">
                      {getInteractionEmoji(interaction.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-slate-400">
                          {new Date(interaction.timestamp).toLocaleDateString('id-ID')} {formatTime(new Date(interaction.timestamp))}
                        </span>
                        <span className="capitalize text-xs px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-200 font-semibold">
                          {interaction.type}
                        </span>
                      </div>
                      {interaction.message && (
                        <div className="mt-2 p-3 bg-slate-800/50 rounded-lg text-slate-200">
                          <p className="text-sm">{interaction.message}</p>
                        </div>
                      )}
                      {interaction.response && (
                        <div className="mt-3 flex">
                          <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-lg shadow-lg">
                            {getPetEmoji(pet.type)}
                          </div>
                          <div className="ml-2 p-3 bg-gradient-to-r from-amber-950/40 to-orange-950/30 rounded-lg flex-1">
                            <p className="text-amber-100/90 text-sm">{interaction.response}</p>
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

        {/* Interaction Controls - visually distinct, more open */}
        <div className="bg-gradient-to-t from-slate-900/90 to-slate-900/60 px-8 py-6 rounded-b-3xl shadow-up">
          <div className="grid grid-cols-4 gap-4 mb-4">
            <button
              onClick={() => handleInteraction('feed')}
              disabled={isInteracting}
              className={`group py-4 rounded-xl text-base flex flex-col items-center justify-center font-semibold transition-all focus-ring ${
                isInteracting && interactionType === 'feed'
                  ? 'bg-amber-600/40 text-white disabled:opacity-70'
                  : 'bg-gradient-to-b from-amber-600/20 to-amber-700/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-100 disabled:opacity-50'
              }`}
            >
              <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">🍖</span>
              {isInteracting && interactionType === 'feed' ? (
                <span className="flex items-center text-xs">
                  <div className="w-4 h-4 border-2 border-amber-300/20 border-t-amber-300/80 rounded-full animate-spin mr-1"></div>
                </span>
              ) : <span className="text-xs">Beri Makan</span>}
            </button>
            <button
              onClick={() => handleInteraction('clean')}
              disabled={isInteracting}
              className={`group py-4 rounded-xl text-base flex flex-col items-center justify-center font-semibold transition-all focus-ring ${
                isInteracting && interactionType === 'clean'
                  ? 'bg-green-600/40 text-white disabled:opacity-70'
                  : 'bg-gradient-to-b from-green-600/20 to-green-700/20 hover:from-green-500/30 hover:to-green-600/30 text-green-100 disabled:opacity-50'
              }`}
            >
              <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">🧹</span>
              {isInteracting && interactionType === 'clean' ? (
                <span className="flex items-center text-xs">
                  <div className="w-4 h-4 border-2 border-green-300/20 border-t-green-300/80 rounded-full animate-spin mr-1"></div>
                </span>
              ) : <span className="text-xs">Bersihkan</span>}
            </button>
            <button
              onClick={() => handleInteraction('play')}
              disabled={isInteracting}
              className={`group py-4 rounded-xl text-base flex flex-col items-center justify-center font-semibold transition-all focus-ring ${
                isInteracting && interactionType === 'play'
                  ? 'bg-blue-600/40 text-white disabled:opacity-70'
                  : 'bg-gradient-to-b from-blue-600/20 to-blue-700/20 hover:from-blue-500/30 hover:to-blue-600/30 text-blue-100 disabled:opacity-50'
              }`}
            >
              <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">🎾</span>
              {isInteracting && interactionType === 'play' ? (
                <span className="flex items-center text-xs">
                  <div className="w-4 h-4 border-2 border-blue-300/20 border-t-blue-300/80 rounded-full animate-spin mr-1"></div>
                </span>
              ) : <span className="text-xs">Bermain</span>}
            </button>
            <button
              onClick={() => handleInteraction('pet')}
              disabled={isInteracting}
              className={`group py-4 rounded-xl text-base flex flex-col items-center justify-center font-semibold transition-all focus-ring ${
                isInteracting && interactionType === 'pet'
                  ? 'bg-purple-600/40 text-white disabled:opacity-70'
                  : 'bg-gradient-to-b from-purple-600/20 to-purple-700/20 hover:from-purple-500/30 hover:to-purple-600/30 text-purple-100 disabled:opacity-50'
              }`}
            >
              <span className="text-3xl mb-1 group-hover:scale-110 transition-transform">✋</span>
              {isInteracting && interactionType === 'pet' ? (
                <span className="flex items-center text-xs">
                  <div className="w-4 h-4 border-2 border-purple-300/20 border-t-purple-300/80 rounded-full animate-spin mr-1"></div>
                </span>
              ) : <span className="text-xs">Belai</span>}
            </button>
          </div>
          {/* Talk interaction - visually distinct */}
          <div className="flex space-x-3 mt-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Bicara dengan ${pet.name}...`}
                className="input-modern py-4 px-5 text-base font-medium bg-slate-800/60 border-0 rounded-xl focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-500"
                disabled={isInteracting}
              />
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-500">
                <span className="text-xl">💭</span>
              </div>
            </div>
            <button
              onClick={() => handleInteraction('talk')}
              disabled={isInteracting || !message.trim()}
              className={`px-7 py-4 rounded-xl flex items-center whitespace-nowrap font-semibold text-base focus-ring transition-all ${
                isInteracting && interactionType === 'talk'
                  ? 'bg-indigo-600/40 text-white disabled:opacity-70'
                  : 'bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 text-white disabled:opacity-50'
              }`}
            >
              {isInteracting && interactionType === 'talk' ? (
                <span className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-2"></div>
                  Mengirim...
                </span>
              ) : (
                <>
                  <span className="text-xl mr-2">💬</span>
                  Kirim
                </>
              )}
            </button>
          </div>
        </div>

        {/* Delete confirmation dialog - visually improved */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-gradient-to-b from-slate-800 to-slate-900 border-l-4 border-red-500 rounded-2xl shadow-2xl p-8 max-w-md w-full animate-slide-up">
              <div className="flex items-center mb-4">
                <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mr-4 text-red-400">
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-white">Hapus Peliharaan</h3>
              </div>
              <p className="text-slate-200 mb-8 ml-1 text-base">
                Apakah Anda yakin ingin menghapus <span className="text-amber-300 font-semibold">{pet.name}</span>? Tindakan ini tidak dapat dibatalkan dan semua riwayat interaksi akan hilang.
              </p>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-5 py-3 rounded-xl bg-slate-700/60 hover:bg-slate-600/60 text-slate-200 transition-colors text-base font-medium focus-ring"
                  disabled={isDeleting}
                >
                  Batal
                </button>
                <button
                  onClick={handleDeletePet}
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-base px-5 py-3 rounded-xl shadow transition-colors font-semibold focus-ring disabled:opacity-50"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <span className="flex items-center">
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-2"></div>
                      Menghapus...
                    </span>
                  ) : 'Hapus Permanen'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Fix the default export
export default PetInteractionComponent;
