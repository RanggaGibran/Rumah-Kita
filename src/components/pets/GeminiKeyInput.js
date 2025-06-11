// GeminiKeyInput.js - A component for managing the Gemini API key
import React, { useState, useEffect } from 'react';

const LOCAL_STORAGE_KEY = 'RUMAH_KITA_GEMINI_API_KEY';

const GeminiKeyInput = ({ onApiKeyChange }) => {
  const [apiKey, setApiKey] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Load API key from localStorage on component mount
  useEffect(() => {
    const savedKey = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedKey) {
      setApiKey(savedKey);
      // Notify parent if a callback was provided
      if (onApiKeyChange) {
        onApiKeyChange(savedKey);
      }
    }
  }, [onApiKeyChange]);

  const handleSaveKey = () => {
    if (apiKey.trim()) {
      // Save to localStorage
      localStorage.setItem(LOCAL_STORAGE_KEY, apiKey.trim());
      
      // Notify parent if a callback was provided
      if (onApiKeyChange) {
        onApiKeyChange(apiKey.trim());
      }
    }
    setIsEditing(false);
  };

  const handleClearKey = () => {
    setApiKey('');
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    
    // Notify parent if a callback was provided
    if (onApiKeyChange) {
      onApiKeyChange('');
    }
    
    setIsEditing(true);
  };

  if (!isEditing && apiKey) {
    return (
      <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-1">Gemini API Key</h3>
            <p className="text-xs text-slate-400">
              {isVisible ? apiKey : '••••••••••••' + apiKey.substring(apiKey.length - 4)}
            </p>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => setIsVisible(!isVisible)} 
              className="text-slate-400 hover:text-slate-200 text-sm"
              title={isVisible ? "Hide API key" : "Show API key"}
            >
              {isVisible ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
            <button 
              onClick={() => setIsEditing(true)} 
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
            <button 
              onClick={handleClearKey} 
              className="text-red-400 hover:text-red-300 text-sm"
              title="Clear API key"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50">
      <h3 className="text-sm font-medium text-slate-300 mb-2">Gemini API Key</h3>
      <p className="text-xs text-slate-400 mb-3">
        Untuk interaksi yang lebih baik dengan peliharaan, masukan <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Gemini API key</a> Anda.
      </p>
      
      <div className="flex space-x-2">
        <input
          type={isVisible ? "text" : "password"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Paste Gemini API key here..."
          className="flex-1 input-modern text-sm"
        />
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="px-2 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors"
          title={isVisible ? "Hide API key" : "Show API key"}
        >
          {isVisible ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
      
      <div className="mt-3 flex justify-end">
        <button
          onClick={handleSaveKey}
          disabled={!apiKey.trim()}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md disabled:opacity-50 transition-colors"
        >
          Save API Key
        </button>
      </div>
    </div>
  );
};

export default GeminiKeyInput;
