import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Pet } from '../../types/pet';
import { 
  subscribeToHomePets,
  updateAllPetStates
} from '../../services/firebase/pets';
import PetCard from './PetCard.js';
import AddPet from './AddPet.js';
import PetInteraction from './PetInteraction.js';

interface PetsListProps {
  homeId: string;
}

const PetsList: React.FC<PetsListProps> = ({ homeId }) => {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!homeId || !currentUser) return;
    
    // Subscribe to real-time updates for pets
    const unsubscribe = subscribeToHomePets(homeId, (updatedPets) => {
      setPets(updatedPets);
      setLoading(false);
    });
    
    // Update pet states when component mounts
    updateAllPetStates(homeId).catch(err => {
      console.error("Failed to update pet states:", err);
    });

    return () => unsubscribe && unsubscribe();
  }, [homeId, currentUser]);

  const handleSelectPet = (pet: Pet) => {
    setSelectedPet(pet);
  };

  const handleCloseInteraction = () => {
    setSelectedPet(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-t-transparent border-blue-500 animate-spin"></div>
          <div className="mt-4 text-blue-400 text-sm animate-pulse">Memuat Pets...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="mx-4 mt-4 p-4 bg-red-900/30 border border-red-500/30 rounded-lg animate-fade-in relative" role="alert">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-red-200">{error}</span>
          </div>
          <button 
            onClick={() => setError('')}
            className="absolute top-2 right-2 text-red-400 hover:text-red-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      
      <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/30 bg-slate-900/30">
        <div>
          <h2 className="text-xl font-semibold text-gradient bg-gradient-to-r from-orange-400 to-amber-500 mb-1">Hewan Peliharaan</h2>
          <p className="text-sm text-slate-400">Rawat dan interaksi dengan peliharaan virtual kamu</p>
        </div>
        
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary text-sm px-4 py-2 flex items-center justify-center shadow-soft hover:shadow-medium"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Tambah Peliharaan
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-transparent to-slate-800/30" style={{ minHeight: '500px' }}>
        {pets.length === 0 ? (
          <div className="text-center p-8 text-slate-400">
            <div className="text-5xl mb-3 opacity-50">🐾</div>
            <p>Belum ada hewan peliharaan</p>
            <p className="text-sm mt-2">Tambahkan peliharaan pertama Anda untuk mulai berinteraksi</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {pets.map(pet => (
              <PetCard
                key={pet.id}
                pet={pet}
                onClick={() => handleSelectPet(pet)}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Add Pet Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <AddPet
            homeId={homeId}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {/* Pet Interaction Modal */}
      {selectedPet && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <PetInteraction
            pet={selectedPet}
            onClose={handleCloseInteraction}
          />
        </div>
      )}
    </div>
  );
};

export default PetsList;
