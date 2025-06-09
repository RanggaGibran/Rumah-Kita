import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { updateNote, subscribeToNote } from '../../services/firebase/notes';
import { Note } from '../../types/user';

interface NoteEditorProps {
  note: Note;
}

const NoteEditor: React.FC<NoteEditorProps> = ({ note }) => {
  const { currentUser } = useAuth();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState('');
  
  // Refs untuk tracking perubahan
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe ke perubahan real-time dari note ini
  useEffect(() => {
    const unsubscribe = subscribeToNote(note.id, (updatedNote) => {
      if (updatedNote && updatedNote.id === note.id) {
        // Hanya update jika user sedang tidak mengedit
        if (!isEditing) {
          setTitle(updatedNote.title);
          setContent(updatedNote.content);
        }
      }
    });

    return () => unsubscribe();
  }, [note.id, isEditing]);

  // Reset state ketika note berubah
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setIsEditing(false);
    setError('');
  }, [note.id, note.title, note.content]);

  // Auto-save dengan debounce
  const autoSave = async (newTitle: string, newContent: string) => {
    if (!currentUser) return;
    
    // Clear timeout sebelumnya
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set timeout baru untuk auto-save
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSaving(true);
        setError('');
        
        const { success, error } = await updateNote(note.id, {
          title: newTitle,
          content: newContent,
        });

        if (error) {
          setError(error);
        } else if (success) {
          setLastSaved(new Date());
        }
      } catch (err: any) {
        setError('Gagal menyimpan: ' + err.message);
      } finally {
        setIsSaving(false);
      }
    }, 1000); // Auto-save setelah 1 detik tidak ada perubahan
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    setIsEditing(true);
    autoSave(newTitle, content);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setIsEditing(true);
    autoSave(title, newContent);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  // Cleanup timeout saat component unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={handleTitleChange}
          onFocus={() => setIsEditing(true)}
          onBlur={handleBlur}
          className="w-full text-xl font-semibold border-none outline-none bg-transparent resize-none"
          placeholder="Judul note..."
        />
        
        {/* Status Bar */}
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <div className="flex items-center space-x-4">
            <span>
              Dibuat: {note.createdAt.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
            {lastSaved && (
              <span>
                Disimpan: {lastSaved.toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {isSaving && (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-500 mr-1"></div>
                <span>Menyimpan...</span>
              </div>
            )}
            
            {isEditing && !isSaving && (
              <span className="text-orange-500">Mengetik...</span>
            )}
            
            {!isEditing && !isSaving && lastSaved && (
              <span className="text-green-500">✓ Tersimpan</span>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 text-sm rounded">
            {error}
          </div>
        )}
      </div>

      {/* Content Editor */}
      <div className="flex-1 p-4">
        <textarea
          ref={contentRef}
          value={content}
          onChange={handleContentChange}
          onFocus={() => setIsEditing(true)}
          onBlur={handleBlur}
          className="w-full h-full border-none outline-none resize-none text-gray-700 leading-relaxed"
          placeholder="Mulai menulis..."
        />
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {content.length} karakter
          </span>
          <span>
            Terakhir diubah: {note.updatedAt.toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default NoteEditor;
