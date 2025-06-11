// JavaScript version of AddPet component converted from TypeScript
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createPet } from '../../services/firebase/pets';
const AddPet = ({ homeId, onCancel }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('dog'); // Default pet type
  const [personality, setPersonality] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();  // List of pet types and personalities for selection
  const petTypes = ['dog', 'cat', 'bird', 'rabbit', 'fish', 'hamster', 'turtle']; // Pet types from pet.ts
  
  const petPersonalities = [
    'Ceria', 'Pemalu', 'Aktif', 'Tenang', 'Playful', 
    'Pemalas', 'Penasaran', 'Pemberani', 'Bersahabat', 'Mandiri'
  ];

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
  }, []);  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim() || !personality) {
      setError('Nama dan sifat hewan peliharaan harus diisi');
      return;
    }
    
    if (!currentUser) {
      setError('Anda harus login untuk menambahkan hewan peliharaan');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
      try {
      const { pet, error } = await createPet(
        homeId,
        currentUser.uid,
        name.trim(),
        type,
        personality,
        null // Explicitly pass null instead of undefined for imageUrl
      );
      
      if (error) {
        setError(error);
        return;
      }
      
      if (pet) {
        onCancel(); // Close the form if successful
      }
    } catch (err) {
      setError('Terjadi kesalahan: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };  const getPetEmoji = (petType) => {
    switch (petType) {
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center animate-fade-in">
      <div className="relative mx-auto p-6 w-full max-w-md card-modern shadow-hard" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        {error && (
          <div className="p-4 mb-4 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        <div className="mt-1">
          <h3 className="text-xl font-semibold text-gradient bg-gradient-to-r from-orange-400 to-amber-500 mb-5">
            Tambah Hewan Peliharaan
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1.5">
                Nama <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-modern w-full shadow-soft focus:shadow-medium"
                placeholder="Masukkan nama peliharaan"
                required
                disabled={isSubmitting}
                autoFocus
              />
            </div>
            
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-slate-300 mb-1.5">
                Jenis Hewan <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
                {petTypes.map((petType) => (
                  <button
                    key={petType}
                    type="button"
                    onClick={() => setType(petType)}
                    className={`p-3 rounded-lg flex flex-col items-center justify-center transition-colors ${
                      type === petType
                        ? 'bg-gradient-to-br from-amber-600/70 to-orange-600/70 text-white shadow-soft'
                        : 'bg-slate-800/60 hover:bg-slate-700/60 text-slate-300'
                    }`}
                    disabled={isSubmitting}
                  >
                    <span className="text-xl sm:text-2xl mb-1">{getPetEmoji(petType)}</span>
                    <span className="text-xs capitalize">{petType}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label htmlFor="personality" className="block text-sm font-medium text-slate-300 mb-1.5">
                Sifat/Karakter <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                {petPersonalities.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPersonality(p)}
                    className={`px-3 py-2 rounded-md text-sm transition-colors ${
                      personality === p
                        ? 'bg-gradient-to-r from-blue-600/70 to-indigo-600/70 text-white shadow-soft'
                        : 'bg-slate-800/60 hover:bg-slate-700/60 text-slate-300'
                    }`}
                    disabled={isSubmitting}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-5">
              <button
                type="button"
                onClick={onCancel}
                className="btn-secondary text-sm px-5 py-2.5 flex items-center"
                disabled={isSubmitting}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Batal
              </button>
              <button
                type="submit"
                className="btn-primary text-sm px-5 py-2.5 flex items-center shadow-soft hover:shadow-medium disabled:opacity-50"
                disabled={isSubmitting || !name.trim() || !personality}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mr-2"></div>
                    Menambahkan...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Tambah Peliharaan
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
        
        {/* Close button */}
        <button 
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-smooth p-1 rounded-full hover:bg-slate-700/50"
          onClick={onCancel}
          disabled={isSubmitting}
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default AddPet;
