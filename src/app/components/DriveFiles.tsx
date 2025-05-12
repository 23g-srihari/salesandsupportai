"use client";

import { useSession, signIn, signOut } from 'next-auth/react';
import { useState } from 'react';
import {
  FaGoogleDrive, FaSignInAlt, FaSignOutAlt, FaFolderOpen, FaCheckCircle,
  FaExternalLinkAlt, FaCloudUploadAlt, FaTimes, FaTrashAlt, FaFilePdf,
  FaFileWord, FaFileExcel, FaFilePowerpoint, FaFileImage, FaFileAlt,
  FaFileArchive, FaFileVideo, FaFileAudio, FaFileCode, FaFolder
} from 'react-icons/fa';

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

function loadPickerScript(callback: () => void) {
  if (document.getElementById('google-picker')) {
    callback();
    return;
  }
  const script = document.createElement('script');
  script.id = 'google-picker';
  script.src = 'https://apis.google.com/js/api.js';
  script.onload = callback;
  document.body.appendChild(script);
}

function getDriveIcon(file: any) {
  if (file.iconUrl && file.mimeType.startsWith('image/')) {
    return <img src={file.iconUrl} alt="thumb" className="w-10 h-10 rounded shadow object-cover" />;
  }
  if (file.mimeType === 'application/vnd.google-apps.folder') return <FaFolder className="text-yellow-400 w-10 h-10" />;
  if (file.mimeType === 'application/pdf') return <FaFilePdf className="text-red-500 w-10 h-10" />;
  if (file.mimeType.includes('word')) return <FaFileWord className="text-blue-600 w-10 h-10" />;
  if (file.mimeType.includes('excel')) return <FaFileExcel className="text-green-600 w-10 h-10" />;
  if (file.mimeType.includes('powerpoint')) return <FaFilePowerpoint className="text-orange-500 w-10 h-10" />;
  if (file.mimeType.startsWith('image/')) return <FaFileImage className="text-blue-400 w-10 h-10" />;
  if (file.mimeType.includes('zip') || file.mimeType.includes('rar')) return <FaFileArchive className="text-yellow-600 w-10 h-10" />;
  if (file.mimeType.startsWith('video/')) return <FaFileVideo className="text-purple-400 w-10 h-10" />;
  if (file.mimeType.startsWith('audio/')) return <FaFileAudio className="text-pink-400 w-10 h-10" />;
  if (file.mimeType.startsWith('text/') || file.mimeType.includes('code')) return <FaFileCode className="text-gray-400 w-10 h-10" />;
  if (file.mimeType === 'application/vnd.google-apps.document') return <FaFileWord className="text-blue-600 w-10 h-10" />;
  if (file.mimeType === 'application/vnd.google-apps.spreadsheet') return <FaFileExcel className="text-green-600 w-10 h-10" />;
  if (file.mimeType === 'application/vnd.google-apps.presentation') return <FaFilePowerpoint className="text-orange-500 w-10 h-10" />;
  return <FaFileAlt className="text-gray-300 w-10 h-10" />;
}

interface DriveFilesProps {
  onClose?: () => void;
}

export default function DriveFiles({ onClose }: DriveFilesProps) {
  const { data: session, status } = useSession();
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

  const openPicker = () => {
    setError(null);
    setPickerLoading(true);
    loadPickerScript(() => {
      window.gapi.load('picker', { callback: createPicker });
    });
  };

  function createPicker() {
    setPickerLoading(false);
    const view = new window.google.picker.DocsView()
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false)
      .setMode(window.google.picker.DocsViewMode.LIST)
      .setMimeTypes('application/vnd.google-apps.document,application/pdf,text/plain');
    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(session?.accessToken)
      .setDeveloperKey(apiKey)
      .setCallback(pickerCallback)
      .setTitle('Select Docs, PDFs, or Text Files from Google Drive')
      .build();
    picker.setVisible(true);
  }

  function pickerCallback(data: any) {
    if (data.action === window.google.picker.Action.PICKED) {
      setSelectedFiles(data.docs);
    }
    if (data.action === window.google.picker.Action.CANCEL) {
      setError('Picker closed without selection.');
    }
  }

  async function fetchFileContent(file: any, accessToken: string) {
    // For text files, fetch as text. For PDFs, fetch as base64.
    if (file.mimeType === 'text/plain') {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return await res.text();
    } else if (file.mimeType === 'application/pdf') {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob); // base64
      });
    } else if (file.mimeType === 'application/vnd.google-apps.document') {
      // Export Google Doc as plain text
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return await res.text();
    }
    return null;
  }

  async function handleUpload() {
    setUploading(true);
    try {
      if (!session || !session.accessToken) {
        alert('Not authenticated. Please sign in again.');
        setUploading(false);
        return;
      }
      const filesToUpload = await Promise.all(
        selectedFiles
          .filter(file => [
            'application/vnd.google-apps.document',
            'application/pdf',
            'text/plain'
          ].includes(file.mimeType))
          .map(async (file) => {
            const content = await fetchFileContent(file, session.accessToken!);
            return {
              name: file.name,
              path: file.id,
              bucket: 'default',
              mime_type: file.mimeType,
              size_bytes: file.sizeBytes || file.size_bytes || null,
              content,
            };
          })
      );
      const res = await fetch('/api/sales-ai/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: filesToUpload, uploaded_by: session.user?.email }),
      });
      const data = await res.json();
      // console.log('Upload API response:', data);
      if (data.success) {
        setSuccessToast('Files uploaded to Supabase!');
        setSelectedFiles([]);
        setTimeout(() => {
          setSuccessToast(null);
          if (onClose) onClose();
        }, 1000);
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    }
    setUploading(false);
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="relative bg-gray-900/90 border border-gray-700 rounded-3xl shadow-2xl p-8 w-full max-w-md mx-auto animate-fade-in">
        {/* Close Button */}
        {onClose && (
          <button
            className="absolute top-4 right-4 sm:top-6 sm:right-6 text-gray-400 hover:text-red-400 text-2xl font-bold z-10 transition-colors"
            onClick={onClose}
          >
            <FaTimes />
          </button>
        )}

        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <FaGoogleDrive className="text-5xl text-green-400 drop-shadow mb-2 animate-bounce-slow" />
          <h2 className="text-2xl sm:text-3xl font-bold text-green-200 tracking-tight mb-1">Connect to Google Drive</h2>
          {/* <p className="text-gray-400 text-sm">Select files directly from your Drive</p> REMOVED */}
        </div>

        {/* Auth State */}
        {status === 'loading' && (
          <div className="flex justify-center items-center py-8">
            <span className="text-gray-300 animate-pulse">Loading...</span>
          </div>
        )}

        {status !== 'authenticated' && status !== 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <button
              className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-full shadow text-lg font-semibold"
              onClick={() => signIn('google')}
            >
              <FaSignInAlt /> Connect to Google Drive
            </button>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
        )}

        {status === 'authenticated' && (
          <>
            {selectedFiles.length > 0 && (
              <div className="mt-4 animate-fade-in-up">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="flex items-center gap-2 text-green-200 font-semibold">
                    <FaCheckCircle className="text-green-400" /> Selected file(s):
                  </h3>
                  <button
                    className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-red-600 text-white rounded-full text-xs font-semibold"
                    onClick={() => setSelectedFiles([])}
                  >
                    <FaTrashAlt /> Clear
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {selectedFiles
                    .filter(file => [
                      'application/vnd.google-apps.document',
                      'application/pdf',
                      'text/plain'
                    ].includes(file.mimeType))
                    .map((file, idx) => (
                      <div
                        key={file.id || idx}
                        className="relative flex flex-col items-center bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600 rounded-xl p-4 shadow-md hover:shadow-2xl transition-all group animate-fade-in-up"
                      >
                        <button
                          className="absolute top-2 right-2 text-gray-400 hover:text-red-500 bg-gray-900/80 rounded-full p-1 z-10"
                          onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== idx))}
                          aria-label="Remove file"
                        >
                          <FaTimes />
                        </button>
                        <div className="mb-2 w-14 h-14 flex justify-center items-center">
                          {getDriveIcon(file)}
                        </div>
                        <span className="text-gray-100 font-semibold text-center truncate w-full" title={file.name}>{file.name}</span>
                        <span className="text-xs text-gray-400 mb-2">{file.mimeType}</span>
                        {file.url && (
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 mt-2 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded-full text-xs font-semibold shadow"
                          >
                            <FaGoogleDrive /> Open in Drive
                          </a>
                        )}
                      </div>
                    ))}
                </div>
                <div className="mt-6">
                  <button
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-full shadow font-semibold text-base disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                    onClick={handleUpload}
                    disabled={uploading || selectedFiles.length === 0}
                  >
                    {uploading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <FaCloudUploadAlt /> Upload
                      </>
                    )}
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 mt-4">
                  <button
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full shadow font-semibold text-base transition-all"
                    onClick={() => signOut({ redirect: false })}
                  >
                    <FaSignOutAlt /> Disconnect
                  </button>
                  <button
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow font-semibold text-base transition-all ${pickerLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                    onClick={openPicker}
                    disabled={pickerLoading}
                  >
                    <span className="flex items-center gap-2">
                      Add from <FaGoogleDrive className="text-lg" />
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Add from Google Drive button if no files are selected */}
            {status === 'authenticated' && selectedFiles.length === 0 && (
              <div className="mb-6">
                <button
                  className={`w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow font-semibold text-base transition-all ${pickerLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                  onClick={openPicker}
                  disabled={pickerLoading}
                >
                  <span className="flex items-center gap-2">
                    Add from <FaGoogleDrive className="text-lg" />
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Animations */}
      <style jsx global>{`
        .animate-fade-in { animation: fadeIn 0.5s ease-in-out; }
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-in-out; }
        .animate-bounce-slow { animation: bounce 2s infinite; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      `}</style>

      {/* Toast/Feedback */}
      {successToast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-8 bg-green-700 text-white px-6 py-2 rounded-full shadow-lg animate-fade-in-up z-50">
          {successToast}
        </div>
      )}
    </div>
  );
}
 