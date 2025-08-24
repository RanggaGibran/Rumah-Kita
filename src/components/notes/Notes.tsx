import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  createNote, 
  subscribeToHomeNotes, 
  deleteNote 
} from '../../services/firebase/notes';
import { Note } from '../../types/user';
import NoteEditor from './NoteEditor';

const Notes: React.FC = () => {
  const { homeId } = useParams<{ homeId: string }>();
  const { currentUser } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Check window size to determine mobile view
  useLayoutEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
      // On larger screens, always show sidebar
      if (window.innerWidth >= 768) {
        setShowSidebar(true);
      }
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  useEffect(() => {
    if (!homeId) return;

    const unsubscribe = subscribeToHomeNotes(homeId, (updatedNotes) => {
      setNotes(updatedNotes);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [homeId]);

  // If on mobile, and there's a selected note, hide sidebar by default
  useEffect(() => {
    if (isMobile && selectedNote) {
      setShowSidebar(false);
    }
  }, [selectedNote, isMobile]);

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !homeId || !newNoteTitle.trim()) return;

    try {
      setError('');
      const { note, error } = await createNote(homeId, currentUser.uid, newNoteTitle.trim());
      
      if (error) {
        setError(error);
        return;
      }

      if (note) {
        setSelectedNote(note);
        setNewNoteTitle('');
        setIsCreating(false);
        // On mobile, switch to note view after creating
        if (isMobile) {
          setShowSidebar(false);
        }
      }
    } catch (err: any) {
      setError('Gagal membuat note: ' + err.message);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus note ini?')) return;
    
    try {
      setError('');
      const { success, error } = await deleteNote(noteId);
      
      if (error) {
        setError(error);
        return;
      }

      if (success && selectedNote?.id === noteId) {
        setSelectedNote(null);
        // If on mobile, show sidebar after deleting the note
        if (isMobile) {
          setShowSidebar(true);
        }
      }
    } catch (err: any) {
      setError('Gagal menghapus note: ' + err.message);
    }
  };

  // Function to handle selecting a note - especially for mobile view
  const handleNoteSelect = (note: Note) => {
    setSelectedNote(note);
    // On mobile, switch to note view
    if (isMobile) {
      setShowSidebar(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="loading-spinner"></div>
          <div className="mt-4 text-blue-400 text-sm animate-pulse">Memuat notes...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-full card-modern overflow-hidden shadow-hard">
      {/* Mobile View Toggle - Show only when a note is selected */}
      {(selectedNote || !showSidebar) && (
        <div className="md:hidden p-2 border-b border-slate-700/30 bg-slate-800/60 sticky top-0 z-10">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="flex items-center justify-center w-full px-3 py-2 rounded-md bg-slate-700/50 hover:bg-slate-600/50 text-slate-200 transition-smooth"
          >
            {showSidebar ? (
              <><svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg> Lihat Note</>
            ) : (
              <><svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg> Lihat Daftar Notes</>
            )}
          </button>
        </div>
      )}
      
      {/* Sidebar - Daftar Notes */}
      <div className={`${showSidebar ? 'block' : 'hidden'} md:block w-full md:w-1/3 lg:w-1/4 border-r border-slate-700/30 flex flex-col glassmorphism bg-slate-800/40 md:max-h-none ${isMobile ? 'h-[calc(100vh-200px)]' : ''}`}>
        <div className="p-4 sm:p-6 border-b border-slate-700/30 bg-slate-900/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gradient bg-gradient-to-r from-blue-400 to-indigo-500">Notes</h2>
            <button
              onClick={() => setIsCreating(true)}
              className="btn-primary text-sm px-4 py-2 flex items-center shadow-soft hover:shadow-medium"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Buat Note
            </button>
          </div>
          
          {/* Form Create Note */}
          {isCreating && (
            <form onSubmit={handleCreateNote} className="mb-4 animate-scale-in">
              <input
                type="text"
                placeholder="Judul note..."
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                className="input-modern w-full mb-3 shadow-soft focus:shadow-medium"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white rounded-lg transition-smooth flex-1 flex items-center justify-center shadow-soft hover:shadow-medium"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setNewNoteTitle('');
                  }}
                  className="px-4 py-2 text-sm btn-secondary flex-1 flex items-center justify-center shadow-soft"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Batal
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-4 mt-2 p-4 bg-red-900/30 border border-red-500/30 rounded-lg animate-fade-in" role="alert">
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

        {/* Daftar Notes */}
        <div className="flex-1 overflow-y-auto p-2 bg-gradient-to-b from-transparent to-slate-800/40">
          {notes.length === 0 ? (
            <div className="text-center p-6 text-slate-400">
              <div className="text-5xl mb-3 opacity-50">📝</div>
              <p>Belum ada notes</p>
              <p className="text-sm mt-2">Buat note pertama Anda untuk berbagi dengan anggota rumah</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notes
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                .map(note => (
                  <div 
                    key={note.id}
                    onClick={() => handleNoteSelect(note)}
                    className={`p-3 rounded-lg glassmorphism cursor-pointer transition-transform duration-200 hover:translate-y-[-2px] hover:shadow-medium ${
                      selectedNote?.id === note.id
                        ? "bg-blue-600/20 border border-blue-500/30"
                        : "bg-slate-800/40 hover:bg-slate-700/40 border border-slate-700/30"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="font-medium text-slate-200 truncate">{note.title}</h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNote(note.id);
                        }}
                        className="text-slate-400 hover:text-red-400 p-1 rounded-full transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{note.content || "No content"}</p>
                    <div className="flex items-center mt-2 text-xs text-slate-500">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {new Date(note.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Note Editor - main content */}
      <div className={`${(!isMobile || !showSidebar) ? 'block' : 'hidden'} md:block flex-1 h-full flex flex-col overflow-hidden`}>
        {selectedNote ? (
          <NoteEditor note={selectedNote} />
        ) : (
          <div className="flex items-center justify-center h-full flex-col p-4 text-center">
            <div className="w-24 h-24 rounded-full bg-slate-800/50 flex items-center justify-center mb-4 animate-float">
              <svg className="w-12 h-12 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-gradient bg-gradient-to-r from-blue-400 to-indigo-500 mb-2">Pilih atau Buat Note</h3>
            <p className="text-base text-slate-400 max-w-sm">
              Pilih note dari daftar atau buat note baru untuk mulai menulis
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notes;
