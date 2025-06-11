import React from 'react';
import { Pet } from '../../types/pet';

interface PetCardProps {
  pet: Pet;
  onClick: () => void;
}

const PetCard: React.FC<PetCardProps> = ({ pet, onClick }) => {
  // Helper function to calculate time difference in a human-readable format
  const getTimeDifference = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days > 0) return `${days} hari yang lalu`;
    if (hours > 0) return `${hours} jam yang lalu`;
    if (minutes > 0) return `${minutes} menit yang lalu`;
    return 'Baru saja';
  };
  
  const getEnergyColor = (energy: number) => {
    if (energy > 75) return 'bg-green-500';
    if (energy > 50) return 'bg-lime-500';
    if (energy > 25) return 'bg-yellow-500';
    return 'bg-red-500';
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
  
  const needsAttention = () => {
    const now = new Date();
    const hoursSinceLastFed = (now.getTime() - pet.lastFed.getTime()) / (1000 * 60 * 60);
    const hoursSinceLastCleaned = (now.getTime() - pet.lastCleaned.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceLastFed > 24 || hoursSinceLastCleaned > 48 || pet.energy < 30;
  };

  return (
    <div 
      onClick={onClick}
      className={`glassmorphism p-4 rounded-xl shadow-soft border-l-4 transition-all cursor-pointer hover:-translate-y-1 hover:shadow-medium ${
        needsAttention() ? 'border-l-amber-500/70 animate-pulse' : 'border-l-blue-500/70'
      }`}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <span className="text-3xl">{getPetEmoji(pet.type)}</span>
        </div>
        
        <div className="ml-4 flex-1">
          <div className="flex justify-between items-start">
            <h3 className="text-lg font-semibold text-white">{pet.name}</h3>
            <span className="text-2xl" title={`Mood: ${pet.mood}`}>{getMoodEmoji(pet.mood)}</span>
          </div>
          
          <p className="text-sm text-slate-300 mt-1">{pet.personality} {pet.type}</p>
          
          <div className="mt-3">
            <div className="flex items-center">
              <span className="text-xs text-slate-400 w-16">Energi:</span>
              <div className="flex-1 bg-slate-700/50 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getEnergyColor(pet.energy)}`}
                  style={{ width: `${pet.energy}%` }}
                ></div>
              </div>
            </div>
            
            <div className="flex justify-between mt-3 text-xs text-slate-400">
              <div>
                <div className="flex items-center">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Dibuat {getTimeDifference(pet.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>Interaksi {getTimeDifference(pet.lastInteraction)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PetCard;
