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
  
  // Refs for tracking changes
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stats tracking
  const [charCount, setCharCount] = useState(content.length);
  const [wordCount, setWordCount] = useState(content.trim() ? content.trim().split(/\s+/).length : 0);

  // Subscribe to real-time changes
  useEffect(() => {
    const unsubscribe = subscribeToNote(note.id, (updatedNote) => {
      if (updatedNote && updatedNote.id === note.id) {
        // Only update if user is not currently editing
        if (!isEditing) {
          setTitle(updatedNote.title);
          setContent(updatedNote.content);
          setCharCount(updatedNote.content.length);
          setWordCount(updatedNote.content.trim() ? updatedNote.content.trim().split(/\s+/).length : 0);
        }
      }
    });

    return () => unsubscribe();
  }, [note.id, isEditing]);

  // Reset state when note changes
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setIsEditing(false);
    setError('');
    setCharCount(note.content.length);
    setWordCount(note.content.trim() ? note.content.trim().split(/\s+/).length : 0);
  }, [note.id, note.title, note.content]);

  // Auto-save with debounce
  const autoSave = async (newTitle: string, newContent: string) => {
    if (!currentUser) return;
    
    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save
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
    }, 1000); // Auto-save after 1 second of inactivity
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
    setCharCount(newContent.length);
    setWordCount(newContent.trim() ? newContent.trim().split(/\s+/).length : 0);
    setIsEditing(true);
    autoSave(title, newContent);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  // Cleanup timeout when component unmounts
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="p-6 border-b border-slate-700/30 bg-slate-900/30">
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={handleTitleChange}
          onFocus={() => setIsEditing(true)}
          onBlur={handleBlur}
          className="w-full text-xl font-semibold border-none outline-none bg-transparent text-white resize-none focus:ring-0 focus:outline-none focus:text-blue-300 transition-smooth"
          placeholder="Judul note..."
        />
        
        {/* Status Bar */}
        <div className="flex items-center justify-between mt-4 text-xs">
          <div className="flex items-center space-x-4 text-slate-400">
            <span className="flex items-center px-2 py-1 rounded-md bg-slate-800/50 border border-slate-700/30">
              <svg className="w-3.5 h-3.5 mr-1.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {note.createdAt.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
            {lastSaved && (
              <span className="flex items-center px-2 py-1 rounded-md bg-slate-800/50 border border-slate-700/30">
                <svg className="w-3.5 h-3.5 mr-1.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {lastSaved.toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {isSaving && (
              <div className="flex items-center bg-blue-900/30 px-2.5 py-1 rounded-md border border-blue-500/30">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400 mr-1.5"></div>
                <span className="text-blue-400">Menyimpan...</span>
              </div>
            )}
            
            {isEditing && !isSaving && (
              <span className="text-orange-400 bg-orange-900/30 px-2.5 py-1 rounded-md border border-orange-500/30 flex items-center">
                <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Mengetik...
              </span>
            )}
            
            {!isEditing && !isSaving && lastSaved && (
              <span className="text-green-400 bg-green-900/30 px-2.5 py-1 rounded-md border border-green-500/30 flex items-center">
                <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Tersimpan
              </span>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-3 p-3 bg-red-900/30 border border-red-500/30 rounded-lg flex items-center animate-fade-in" role="alert">
            <svg className="w-4 h-4 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-red-200 text-sm">{error}</span>
            <button 
              onClick={() => setError('')}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Content Editor */}
      <div className="flex-1 p-6 glassmorphism bg-slate-800/20 overflow-auto">
        <textarea
          ref={contentRef}
          value={content}
          onChange={handleContentChange}
          onFocus={() => setIsEditing(true)}
          onBlur={handleBlur}
          className="w-full h-full border-none outline-none bg-transparent resize-none text-slate-300 leading-relaxed focus:ring-0 focus:outline-none text-base"
          placeholder="Mulai menulis..."
          style={{
            minHeight: '300px', // Ensure minimum height
            lineHeight: '1.8'
          }}
        />
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700/30 bg-slate-800/50">
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-4">
            <span className="flex items-center px-2 py-1 rounded-md bg-slate-800/70 border border-slate-700/30">
              <svg className="w-3.5 h-3.5 mr-1.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19V5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2zM13 8h.01M9 8h.01" />
              </svg>
              {charCount} karakter
            </span>
            
            <span className="flex items-center px-2 py-1 rounded-md bg-slate-800/70 border border-slate-700/30">
              <svg className="w-3.5 h-3.5 mr-1.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              {wordCount} kata
            </span>
          </div>

          <span className="flex items-center mt-2 sm:mt-0">
            <svg className="w-3.5 h-3.5 mr-1.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {note.updatedAt.toLocaleDateString('id-ID', {
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
