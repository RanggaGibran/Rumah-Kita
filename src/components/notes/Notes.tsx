import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  createNote, 
  subscribeToHomeNotes, 
  updateNote, 
  deleteNote 
} from '../../services/firebase/notes';
import { Note } from '../../types/user';
import NoteEditor from 'components/notes/NoteEditor';

const Notes: React.FC = () => {
  const { homeId } = useParams<{ homeId: string }>();
  const { currentUser } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!homeId) return;

    const unsubscribe = subscribeToHomeNotes(homeId, (updatedNotes) => {
      setNotes(updatedNotes);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [homeId]);

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
      }
    } catch (err: any) {
      setError('Gagal menghapus note: ' + err.message);
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
    <div className="flex h-full card-modern overflow-hidden shadow-hard">
      {/* Sidebar - Daftar Notes */}
      <div className="w-1/3 border-r border-slate-700/30 flex flex-col glassmorphism bg-slate-800/40">
        <div className="p-6 border-b border-slate-700/30 bg-slate-900/30">
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
            <div className="p-6 text-center text-slate-400 flex flex-col items-center justify-center h-full animate-fade-in">
              <div className="relative w-20 h-20 mb-4">
                <svg className="w-20 h-20 absolute text-blue-900/30 animate-float" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <svg className="w-16 h-16 absolute top-2 left-2 text-indigo-500/20 animate-float" style={{animationDelay: '1s'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-gradient bg-gradient-to-r from-blue-400 to-indigo-500">Belum ada notes</h3>
              <p className="text-sm mt-3 text-slate-400 max-w-xs">
                Buat note pertama Anda untuk menyimpan ide, catatan, atau informasi penting tentang rumah.
              </p>
              <button 
                onClick={() => setIsCreating(true)}
                className="mt-6 btn-primary text-sm px-5 py-2.5 flex items-center mx-auto shadow-soft hover:shadow-medium transition-smooth hover:scale-105"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Mulai Menulis
              </button>
            </div>
          ) : (
            <div className="space-y-2 px-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className={`p-4 rounded-xl cursor-pointer transition-smooth hover:bg-slate-700/30 group animate-fade-in ${
                    selectedNote?.id === note.id 
                      ? 'bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/40 shadow-soft' 
                      : 'border border-transparent hover:border-slate-700/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-medium ${
                        selectedNote?.id === note.id 
                          ? 'text-blue-300' 
                          : 'text-white group-hover:text-blue-200'
                      } truncate transition-smooth`}>
                        {note.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 group-hover:text-slate-300">
                        {note.content ? note.content.substring(0, 100).replace(/\n/g, ' ') : 'No content'}
                        {note.content && note.content.length > 100 && '...'}
                      </p>
                      <p className="text-xs text-slate-500 mt-2 flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {note.updatedAt.toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNote(note.id);
                      }}
                      className="ml-2 text-slate-400 hover:text-red-400 transition-smooth rounded-full p-1.5 hover:bg-red-900/30 opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Note Editor */}
      <div className="flex-1 flex flex-col bg-slate-800/20 glassmorphism">
        {selectedNote ? (
          <NoteEditor note={selectedNote} />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400">
            <div className="text-center p-6 max-w-md animate-fade-in">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <svg className="absolute w-24 h-24 text-blue-900/20 animate-float" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <svg className="absolute w-20 h-20 text-indigo-500/10 top-2 left-2 animate-float" style={{animationDelay: '1.5s'}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="mt-2 text-2xl font-medium text-gradient bg-gradient-to-r from-blue-400 to-indigo-500">Pilih Note</h3>
              <p className="mt-4 text-sm text-slate-400 leading-relaxed">
                Pilih note dari daftar di sidebar atau buat note baru untuk mulai menulis. Notes membantu Anda menyimpan informasi penting tentang rumah Anda.
              </p>
              <button
                onClick={() => setIsCreating(true)}
                className="mt-8 btn-primary text-sm px-6 py-3 flex items-center mx-auto shadow-soft hover:shadow-medium hover:scale-105 transition-smooth"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Buat Note Baru
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notes;
