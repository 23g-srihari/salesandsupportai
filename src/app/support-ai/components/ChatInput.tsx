// src/app/support-ai/components/ChatInput.tsx
'use client';

import React, { useState, KeyboardEvent } from 'react';
import { IoSend } from 'react-icons/io5';
import { SiGoogledrive } from 'react-icons/si';
import { FaTimes, FaFileAlt, FaImage, FaFilePdf, FaFileWord, FaFileArchive, FaSpinner } from 'react-icons/fa';
import { AttachmentPreviewData } from './ChatWindow'; // Import from ChatWindow

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean; // True when AI is responding or message is sending
  onDriveClick: () => void;
  hasAttachment?: boolean; // True if an attachment is staged in ChatWindow
  attachmentPreview?: AttachmentPreviewData | null;
  onRemoveAttachment?: () => void;
  isDrivePickerLoading?: boolean; // True when Google Picker is loading or fetching content
}

// Helper to get a simple icon for the preview
const getPreviewIcon = (mimeType?: string) => {
  if (!mimeType) return <FaFileAlt className="w-6 h-6 text-gray-400" />;
  if (mimeType.startsWith('image/')) return <FaImage className="w-5 h-5 text-blue-400" />;
  if (mimeType === 'application/pdf') return <FaFilePdf className="w-5 h-5 text-red-500" />;
  if (mimeType.includes('word')) return <FaFileWord className="w-5 h-5 text-blue-600" />;
  if (mimeType.includes('zip') || mimeType.includes('archive')) return <FaFileArchive className="w-5 h-5 text-yellow-500" />;
  return <FaFileAlt className="w-5 h-5 text-gray-400" />;
};

export default function ChatInput({ 
  onSendMessage, 
  isLoading, 
  onDriveClick,
  hasAttachment, 
  attachmentPreview,
  onRemoveAttachment,
  isDrivePickerLoading
}: ChatInputProps) {
  const [inputText, setInputText] = useState('');

  const handleSubmit = () => {
    if ((inputText.trim() || hasAttachment) && !isLoading) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const MAX_TEXTAREA_HEIGHT = 120;

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(event.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      let newHeight = textareaRef.current.scrollHeight;
      if (newHeight > MAX_TEXTAREA_HEIGHT) {
        newHeight = MAX_TEXTAREA_HEIGHT;
        textareaRef.current.style.overflowY = 'auto';
      } else {
        textareaRef.current.style.overflowY = 'hidden';
      }
      textareaRef.current.style.height = `${newHeight}px`;
    }
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="bg-gray-700 border-t border-gray-600">
      {attachmentPreview && (
        <div className="p-2.5 px-4 bg-gray-750 border-b border-gray-600 flex items-center justify-between transition-all duration-300 ease-in-out" 
             style={{ opacity: 1, transform: 'translateY(0)' }}>
          <div className="flex items-center gap-2 overflow-hidden">
            {getPreviewIcon(attachmentPreview.mimeType)}
            <span className="text-sm text-gray-200 truncate" title={attachmentPreview.name}>
              {attachmentPreview.name}
            </span>
            {attachmentPreview.size != null && (
              <span className="text-xs text-gray-400 flex-shrink-0">
                ({(attachmentPreview.size / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>
          <button 
            onClick={onRemoveAttachment}
            className="p-1 text-gray-400 hover:text-red-400 rounded-full ml-2"
            aria-label="Remove attachment"
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="p-3 md:p-4 flex items-start gap-2">
        <button
          type="button"
          onClick={onDriveClick}
          disabled={isLoading || isDrivePickerLoading} 
          className="p-2 text-gray-400 hover:text-sky-400 focus:outline-none disabled:opacity-60 disabled:hover:text-gray-400 transition-colors mt-1.5"
          aria-label="Attach from Google Drive"
        >
          {isDrivePickerLoading ? 
            <FaSpinner className="w-6 h-6 animate-spin text-sky-400" /> :
            <SiGoogledrive className="w-6 h-6" />
          }
        </button>
        
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputText}
          onChange={handleTextChange}
          onKeyDown={handleKeyPress}
          placeholder="Type your message..."
          disabled={isLoading} 
          className="flex-grow p-3 bg-gray-600 text-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-gray-400 disabled:opacity-70 resize-none overflow-hidden scrollbar-thin scrollbar-thumb-gray-500 scrollbar-track-gray-600"
          style={{ minHeight: '48px' }}
          aria-label="Message input"
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading || (inputText.trim() === '' && !hasAttachment)} 
          className="p-3 bg-sky-500 text-white rounded-full hover:bg-sky-600 disabled:opacity-50 disabled:hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400 transition-colors ml-1 mt-1.5"
          aria-label="Send message"
        >
          <IoSend className="w-5 h-5" />
        </button>
      </div>
      {/* Minimal style for bg-gray-750 if not in Tailwind config */}
      <style jsx>{`
        .bg-gray-750 { background-color: #404855; } /* A custom shade between gray-700 and gray-800 */
        /* Basic animation for preview appearance */
        .transition-all { transition-property: all; }
        .duration-300 { transition-duration: 300ms; }
        .ease-in-out { transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
      `}</style>
    </div>
  );
}
