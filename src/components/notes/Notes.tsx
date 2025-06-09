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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-white rounded-lg shadow">
      {/* Sidebar - Daftar Notes */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
            <button
              onClick={() => setIsCreating(true)}
              className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              + Buat Note
            </button>
          </div>
          
          {/* Form Create Note */}
          {isCreating && (
            <form onSubmit={handleCreateNote} className="mb-4">
              <input
                type="text"
                placeholder="Judul note..."
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                autoFocus
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setNewNoteTitle('');
                  }}
                  className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Batal
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-4 mt-2 p-2 bg-red-100 border border-red-400 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        {/* Daftar Notes */}
        <div className="flex-1 overflow-y-auto">
          {notes.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p>Belum ada notes.</p>
              <p className="text-sm">Buat note pertama Anda!</p>
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                onClick={() => setSelectedNote(note)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                  selectedNote?.id === note.id ? 'bg-indigo-50 border-indigo-200' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {note.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {note.content.substring(0, 100)}
                      {note.content.length > 100 && '...'}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
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
                    className="ml-2 text-gray-400 hover:text-red-500"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM8 8a1 1 0 012 0v3a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v3a1 1 0 11-2 0V8z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content - Note Editor */}
      <div className="flex-1 flex flex-col">
        {selectedNote ? (
          <NoteEditor note={selectedNote} />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Pilih Note</h3>
              <p className="mt-1 text-sm text-gray-500">
                Pilih note dari daftar atau buat note baru untuk mulai menulis.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notes;
