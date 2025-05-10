// src/app/support-ai/components/ChatInput.tsx
'use client';

import React, { useState, KeyboardEvent } from 'react';
import { IoSend } from 'react-icons/io5';
import { SiGoogledrive } from 'react-icons/si';
// Removed FaTimes, FaFileAlt, FaImage, FaFilePdf as preview is no longer here

// AttachmentPreviewData interface is removed from here, will be in ChatWindow or shared types

interface ChatInputProps {
  onSendMessage: (message: string) => void; // ChatWindow will handle combining text with its attachment state
  isLoading: boolean;
  onDriveClick: () => void; 
  hasAttachment?: boolean; // Optional: to enable send button if only attachment is present
}

export default function ChatInput({ 
  onSendMessage, 
  isLoading, 
  onDriveClick,
  hasAttachment 
}: ChatInputProps) {
  const [inputText, setInputText] = useState('');

  const handleSubmit = () => {
    if ((inputText.trim() || hasAttachment) && !isLoading) {
      onSendMessage(inputText); // ChatWindow will get its own attachment state
      setInputText('');
    }
  };

  // This older handleKeyPress for HTMLInputElement is removed.

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const MAX_TEXTAREA_HEIGHT = 120; // px, approx 5-6 lines

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(event.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
      let newHeight = textareaRef.current.scrollHeight;
      if (newHeight > MAX_TEXTAREA_HEIGHT) {
        newHeight = MAX_TEXTAREA_HEIGHT;
        textareaRef.current.style.overflowY = 'auto'; // Show scrollbar if max height reached
      } else {
        textareaRef.current.style.overflowY = 'hidden'; // Hide scrollbar if below max height
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

  // renderFilePreviewIcon removed

  return (
    // Main div no longer needs to be a flex container for preview, just holds the input row
    <div className="bg-gray-700 p-3 md:p-4 flex items-start gap-2 border-t border-gray-600">
        {/* Google Drive Icon Button */}
        <button
          type="button"
          onClick={onDriveClick}
          disabled={isLoading} 
          className="p-2 text-gray-400 hover:text-sky-400 focus:outline-none disabled:opacity-50 transition-colors mt-1.5"
          aria-label="Attach from Google Drive"
        >
          <SiGoogledrive className="w-6 h-6" />
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
          disabled={isLoading || (inputText.trim() === '' && !hasAttachment)} // Uses hasAttachment prop
          className="p-3 bg-sky-500 text-white rounded-full hover:bg-sky-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-sky-400 transition-colors ml-1 mt-1.5"
          aria-label="Send message"
        >
          <IoSend className="w-5 h-5" />
        </button>
      {/* Attachment Preview JSX removed from here */}
    </div>
  );
}
