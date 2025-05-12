'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FiX, FiPlus, FiTrash2, FiFileText, FiAlertTriangle, FiLoader, FiCheckCircle } from 'react-icons/fi'; // Using Feather Icons for a sleek look

interface Document {
  id: string;
  file_name: string;
  mime_type: string;
  created_at: string;
  processing_status: string;
  size_bytes: number | null;
}

interface DocumentManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFilesClick: () => void; // New prop to trigger file adding (e.g., Google Picker)
}

const DocumentManagerModal: React.FC<DocumentManagerModalProps> = ({ isOpen, onClose, onAddFilesClick }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(null); // Stores ID of doc to delete
  const [searchTerm, setSearchTerm] = useState(""); // State for search term

  const fetchDocuments = useCallback(async () => {
    if (!isOpen) return; // Don't fetch if modal is closed
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/support-ai/documents');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch documents: ${response.statusText}`);
      }
      const data = await response.json();
      setDocuments(data || []);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred while fetching documents.');
      setDocuments([]); // Clear documents on error
    }
    setIsLoading(false);
  }, [isOpen]);

  useEffect(() => {
    fetchDocuments();
  }, [isOpen, fetchDocuments]);

  const handleDeleteClick = (docId: string) => {
    setShowConfirmDialog(docId);
  };

  const confirmDelete = async () => {
    if (!showConfirmDialog) return;
    setDeletingId(showConfirmDialog);
    setError(null);
    try {
      const response = await fetch(`/api/support-ai/documents/${showConfirmDialog}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.warning || `Failed to delete document: ${response.statusText}`);
      }
      // Optimistically remove from UI or refetch
      setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== showConfirmDialog));
      // Optionally, show a success notification here
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred while deleting the document.');
    }
    setDeletingId(null);
    setShowConfirmDialog(null);
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return <FiFileText className="text-red-500" />;
    if (mimeType.startsWith('text')) return <FiFileText className="text-blue-500" />;
    if (mimeType.includes('document')) return <FiFileText className="text-sky-500" />; // Word/Google Docs
    return <FiFileText className="text-gray-500" />;
  };

  const getStatusIndicator = (status: string) => {
    if (status === 'completed' || status === 'embedding_completed') return <FiCheckCircle className="text-green-500" title="Processed" />;
    if (status === 'pending' || status === 'processing' || status === 'embedding_in_progress') return <FiLoader className="animate-spin text-sky-500" title="Processing" />;
    if (status === 'failed' || status === 'embedding_failed' || status === 'unsupported_type') return <FiAlertTriangle className="text-red-500" title={`Failed: ${status}`} />;
    if (status === 'pdf_skipped' || status.includes('_skipped')) return <FiAlertTriangle className="text-yellow-500" title={`Skipped: ${status}`} />;
    return <FiFileText className="text-gray-400" title={status} />;
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out" onClick={onClose}>
      <div 
        className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden border border-slate-700 transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalFadeInScaleUp" 
        onClick={(e) => e.stopPropagation()} // Prevent click inside modal from closing it
        style={{ animationFillMode: 'forwards' }} // Keep final state of animation
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700 bg-slate-750">
          <h2 className="text-2xl font-semibold text-sky-300">Manage Uploaded Documents</h2>
          <div className="flex items-center space-x-2">
            {/* Add Files button REMOVED from header */}
            <button 
              onClick={onClose} 
              className="text-slate-400 hover:text-sky-300 p-1 rounded-full transition-colors duration-150"
              aria-label="Close modal"
            >
              <FiX size={28} />
            </button>
          </div>
        </div>

        {/* Body - Scrollable List */}
        <div className="p-6 space-y-5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-750">
          {isLoading && (
            <div className="flex justify-center items-center py-10">
              <FiLoader className="animate-spin text-sky-400" size={40} />
              <p className="ml-3 text-slate-300">Loading documents...</p>
            </div>
          )}
          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg flex items-center">
              <FiAlertTriangle size={24} className="mr-3" />
              <p>{error}</p>
            </div>
          )}
          {!isLoading && !error && documents.length === 0 && (
            <p className="text-center text-slate-400 py-10">You haven't uploaded any documents yet.</p>
          )}
          {!isLoading && !error && documents.length > 0 && (
            <ul className="divide-y divide-slate-700">
              {documents
                .filter(doc => 
                  doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map((doc) => (
                <li key={doc.id} className="py-4 flex items-center justify-between hover:bg-slate-750/50 transition-colors duration-150 px-2 rounded-md group">
                  <div className="flex items-center min-w-0">
                    <span className="mr-4 text-2xl">{getFileIcon(doc.mime_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-md font-medium text-slate-100 truncate" title={doc.file_name}>{doc.file_name}</p>
                      <p className="text-xs text-slate-400">
                        Uploaded: {new Date(doc.created_at).toLocaleDateString()} {new Date(doc.created_at).toLocaleTimeString()} 
                        {doc.size_bytes && `(${(doc.size_bytes / 1024).toFixed(1)} KB)`}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center">
                        <span className="mr-1.5">Status:</span> 
                        {getStatusIndicator(doc.processing_status)} 
                        <span className="ml-1">{doc.processing_status.replace(/_/g, ' ')}</span>
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteClick(doc.id)}
                    disabled={deletingId === doc.id || !!showConfirmDialog} // Disable if any delete is in progress/confirm
                    className={`p-2 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-900/30 transition-all duration-150 ml-4 group-hover:opacity-100 ${showConfirmDialog && showConfirmDialog !== doc.id ? 'opacity-25' : 'opacity-50'} disabled:opacity-25 disabled:cursor-not-allowed`}
                    aria-label="Delete document"
                  >
                    {deletingId === doc.id ? <FiLoader className="animate-spin" size={20}/> : <FiTrash2 size={20} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer - Search Bar and Add Files Button */}
        <div className="p-4 border-t border-slate-700 bg-slate-750 flex items-center justify-between gap-3">
          <input 
            type="search"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-grow px-3 py-2 bg-slate-600 text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-slate-400 text-sm"
          />
          <button
            onClick={onAddFilesClick}
            className="p-2.5 text-slate-200 bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors duration-150 flex items-center text-sm shrink-0"
            title="Add new documents from Google Drive"
            aria-label="Add new documents"
          >
            <FiPlus size={20} className="mr-1.5" />
            Add Files
          </button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]" onClick={() => setShowConfirmDialog(null)}> 
          <div 
            className="bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 w-full max-w-md transform transition-all duration-200 ease-out scale-95 opacity-0 animate-modalFadeInScaleUp"
            onClick={(e) => e.stopPropagation()} style={{ animationFillMode: 'forwards' }}
          >
            <div className="flex items-center mb-6">
                <FiAlertTriangle size={32} className="text-red-500 mr-4" />
                <h3 className="text-xl font-semibold text-slate-100">Confirm Deletion</h3>
            </div>
            <p className="text-slate-300 mb-2">Are you sure you want to delete this document?</p>
            <p className="text-sm text-slate-400 mb-8">
                <span className="font-medium text-slate-200">{documents.find(d => d.id === showConfirmDialog)?.file_name}</span>
                <br />
                This action cannot be undone. All associated data (chunks, embeddings) will also be removed.
            </p>
            <div className="flex justify-end space-x-4">
              <button 
                onClick={() => setShowConfirmDialog(null)} 
                disabled={!!deletingId}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors duration-150 disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete} 
                disabled={!!deletingId}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors duration-150 flex items-center disabled:opacity-50"
              >
                {deletingId ? <FiLoader className="animate-spin mr-2" /> : <FiTrash2 className="mr-2"/>}
                {deletingId ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Basic CSS for modal animation if not using a library */}
      <style jsx global>{`
        @keyframes modalFadeInScaleUp {
          0% { opacity: 0; transform: scale(0.95) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0px); }
        }
        .animate-modalFadeInScaleUp {
          animation: modalFadeInScaleUp 0.3s ease-out forwards;
        }
        .bg-slate-750 { background-color: #334155; } /* Approx slate-700 + a bit of slate-800 idea */
      `}</style>
    </div>
  );
};

export default DocumentManagerModal;
