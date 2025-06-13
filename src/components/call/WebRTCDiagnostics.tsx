import React, { useState, useEffect } from 'react';
import { 
  runDiagnostics, 
  formatDiagnosticResults, 
  DiagnosticResults,
  ConnectivityResult,
  ConnectionTestType 
} from '../../utils/webrtcDiagnostics';

interface WebRTCDiagnosticsProps {
  onDiagnosticsComplete?: (results: DiagnosticResults) => void;
  onClose?: () => void;
  isOpen: boolean;
}

const WebRTCDiagnostics: React.FC<WebRTCDiagnosticsProps> = ({ 
  onDiagnosticsComplete, 
  onClose,
  isOpen
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResults | null>(null);
  const [formattedResults, setFormattedResults] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Reset state when modal is opened
    if (isOpen) {
      setDiagnosticResults(null);
      setFormattedResults('');
      setError(null);
      setProgress(0);
    }
  }, [isOpen]);

  const handleRunDiagnostics = async () => {
    try {
      setIsRunning(true);
      setError(null);
      setProgress(0);
      setDiagnosticResults(null);
      
      // Show incremental progress during tests
      setProgress(10);
      const results = await runDiagnostics();
      setProgress(100);
      
      // Format and set results
      setDiagnosticResults(results);
      const formatted = formatDiagnosticResults(results);
      setFormattedResults(formatted);
      
      // Call callback if provided
      if (onDiagnosticsComplete) {
        onDiagnosticsComplete(results);
      }
    } catch (err) {
      setError(`Error running diagnostics: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Get status icon based on test result
  const getStatusIcon = (result?: ConnectivityResult) => {
    if (!result) return '⏳'; // Test not run yet
    return result.success ? '✅' : '❌';
  };

  // Reset the diagnostic results
  const handleReset = () => {
    setDiagnosticResults(null);
    setFormattedResults('');
    setError(null);
    setProgress(0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            WebRTC Diagnostik
          </h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {isRunning ? (
          <div className="mb-4">
            <p className="text-gray-700 dark:text-gray-300 mb-2">Menjalankan diagnostik...</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        ) : (
          <>
            {!diagnosticResults ? (
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Uji koneksi WebRTC Anda untuk membantu mendiagnosis masalah panggilan video/audio.
              </p>
            ) : (
              <div className="mb-4">
                <div className="grid grid-cols-1 gap-2 mb-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Koneksi STUN:</span>
                    <span>{getStatusIcon(diagnosticResults.stunConnectivity)}</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Koneksi TURN:</span>
                    <span>{getStatusIcon(diagnosticResults.turnConnectivity)}</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Akses Media:</span>
                    <span>{getStatusIcon(diagnosticResults.mediaAccess)}</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Koneksi ICE:</span>
                    <span>{getStatusIcon(diagnosticResults.iceConnectivity)}</span>
                  </div>
                </div>
                
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">Detail & Rekomendasi:</h3>
                <pre className="whitespace-pre-wrap bg-gray-100 dark:bg-gray-900 p-3 rounded text-sm text-gray-800 dark:text-gray-300 max-h-48 overflow-y-auto">
                  {formattedResults}
                </pre>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end space-x-2 mt-4">
          {diagnosticResults ? (
            <>
              <button
                onClick={handleReset}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                disabled={isRunning}
              >
                Reset
              </button>
              <button
                onClick={handleRunDiagnostics}
                className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
                disabled={isRunning}
              >
                Uji Ulang
              </button>
            </>
          ) : (
            <button
              onClick={handleRunDiagnostics}
              className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
              disabled={isRunning}
            >
              Mulai Diagnostik
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebRTCDiagnostics;