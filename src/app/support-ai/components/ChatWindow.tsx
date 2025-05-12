// src/app/support-ai/components/ChatWindow.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import MessageBubble from './MessageBubble'; 
import ChatInput from './ChatInput';       
import DocumentManagerModal from './DocumentManagerModal'; // Import the modal
import { FaUserCircle } from 'react-icons/fa'; 
import { FiFolder } from 'react-icons/fi'; // Icon for the button

const MAX_CONVERSATION_HISTORY = 6; 

// Define AttachmentPreviewData interface (as discussed for Drive Picker)
export interface AttachmentPreviewData {
  id: string; // Google Drive file ID
  name: string;
  mimeType: string;
  content: string | null; // base64 data URL, text content, or null if not fetched/applicable
  size?: number;
  url?: string; // Google Drive URL (e.g., webViewLink)
}

// Define a type for message objects
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot' | 'system' | 'support'; // Ensure these cover all your needs
  timestamp: Date;
  avatar?: string; // Optional avatar URL
  name?: string; // Optional sender name
  attachment?: AttachmentPreviewData | null; // If messages can directly have attachments shown
}

// For Google Picker API
declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

function loadPickerScript(callback: () => void) {
  if (document.getElementById('google-picker-chat-script')) {
    if (window.gapi && window.gapi.load) {
      window.gapi.load('picker', { callback });
    } else {
      console.error("[ChatWindow] Google API script was loaded but gapi not available. Retrying script add.");
      document.getElementById('google-picker-chat-script')?.remove(); // Remove old to re-add
      addScriptTag(callback);
    }
    return;
  }
  addScriptTag(callback);
}

function addScriptTag(callback: () => void) {
    const script = document.createElement('script');
    script.id = 'google-picker-chat-script';
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
        if (window.gapi && window.gapi.load) {
            window.gapi.load('picker', { callback });
        } else {
            console.error("[ChatWindow] Failed to load Google Picker API even after script.onload.");
        }
    };
    script.onerror = () => {
        console.error("[ChatWindow] Error loading Google API script (script.onerror).");
    };
    document.body.appendChild(script);
}

export default function ChatWindow() {
  const { data: session, status: authStatus } = useSession(); // Renamed status to authStatus
  const [messages, setMessages] = useState<Message[]>([
    // Initial mock messages for UI development - remove or adjust for production
    { id: 'init1', text: 'Hello! How can I assist you?', sender: 'bot', timestamp: new Date(Date.now() - 60000 * 5), name: 'Support AI' },
  ]);
  const [isLoading, setIsLoading] = useState(false); // For general loading (API calls, AI typing)
  const [attachmentForSend, setAttachmentForSend] = useState<AttachmentPreviewData | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false); // Specifically for Google Picker loading
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [isDocManagerOpen, setIsDocManagerOpen] = useState(false); // State for modal visibility

  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY; // For Google Picker

  // New function to handle the actual attachment upload and processing logic
  const processAndUploadAttachment = async (attachmentToProcess: AttachmentPreviewData) => {
    if (!attachmentToProcess) return;

    setIsLoading(true);
    setPickerError(null);
    // Display the selected attachment briefly in the input area if desired, then clear it after processing.
    // This setAttachmentForSend is for UI preview in ChatInput before it gets cleared post-upload.
    setAttachmentForSend(attachmentToProcess); 

    const payload = {
      fileName: attachmentToProcess.name,
      mimeType: attachmentToProcess.mimeType,
      content: attachmentToProcess.content,
      googleDriveFileId: attachmentToProcess.id,
      googleDriveUrl: attachmentToProcess.url,
      sizeBytes: attachmentToProcess.size,
    };

    console.log('[ChatWindow] Attempting to upload document immediately:', payload.fileName);
    try {
      const response = await fetch('/api/support-ai/upload-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log('[ChatWindow] Response from /api/support-ai/upload-document:', result);

      if (response.ok && result.success) {
        const systemMessage: Message = {
          id: String(Date.now()),
          text: `Document "${attachmentToProcess.name}" selected and sent for processing.`,
          sender: 'system',
          timestamp: new Date(),
          name: 'System',
        };
        setMessages(prevMessages => [...prevMessages, systemMessage]);
        setAttachmentForSend(null); // Clear the staged attachment preview from ChatInput
      } else {
        setPickerError(result.error || 'Failed to upload document. Please try again.');
        console.error('[ChatWindow] Error uploading document:', result.error || `Status: ${response.status}`);
        // Keep attachmentForSend so user can see it and potentially retry or remove it if pickerError is shown.
      }
    } catch (error: any) {
      console.error("[ChatWindow] Exception during document upload:", error);
      setPickerError(`Upload failed: ${error.message}`);
    }
    setIsLoading(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetches content from Google Drive (simplified from DriveFiles.tsx)
  const fetchFileContentFromDrive = async (file: any, accessToken: string): Promise<AttachmentPreviewData | null> => {
    let content: string | null = null;
    const commonReturn = {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.sizeBytes || file.size,
        url: file.webViewLink || file.embedLink || file.alternateLink || file.url,
    };

    console.log(`[ChatWindow] Fetching content for Drive file: ${file.name} (MIME: ${file.mimeType})`);

    // For types we want to send content for (used by /api/support-ai/upload-document)
    if (file.mimeType === 'application/vnd.google-apps.document') {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) content = await res.text();
      else console.error("[ChatWindow] Error fetching Google Doc content:", await res.text());
    } else if (file.mimeType === 'text/plain') {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) content = await res.text();
      else console.error("[ChatWindow] Error fetching plain text content:", await res.text());
    } else if (file.mimeType === 'application/pdf') {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.size < 20 * 1024 * 1024) { // 20MB limit for base64 to avoid crashing client
          content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else {
          console.warn(`[ChatWindow] PDF ${file.name} too large (${blob.size} bytes) for base64 content. Will send as reference.`);
          // Content remains null, API will handle it as reference or try fetching later if designed so
        }
      } else console.error("[ChatWindow] Error fetching PDF content:", await res.text());
    } else if (file.mimeType.startsWith('image/')) {
      console.log(`[ChatWindow] Image ${file.name} selected. URL will be used. No content fetched by client.`);
      // For images, content usually remains null for this flow; API might just use metadata or URL
    } else {
      console.log(`[ChatWindow] Content fetching not standard for MIME type: ${file.mimeType}. Will send as reference.`);
    }
    return { ...commonReturn, content };
  };

  // Google Picker callback
  const pickerCallback = async (data: any) => {
    setPickerLoading(false); // Picker has responded
    if (data.action === window.google.picker.Action.PICKED) {
      if (!(session as any)?.accessToken) { // Check for our specific session.accessToken from NextAuth
        setPickerError("Authentication token for Drive not available. Please sign in again or refresh.");
        signIn('google', { callbackUrl: window.location.href }); // Re-prompt sign-in for Drive scopes
        return;
      }
      const file = data.docs[0]; // Assuming MaxItems = 1
      setPickerLoading(true); // Now loading file content
      const driveAccessToken = (session as any).accessToken;
      const attachmentData = await fetchFileContentFromDrive(file, driveAccessToken);
      setPickerLoading(false); // Finished fetching content

      if (attachmentData) {
        setPickerError(null); // Clear previous errors
        if (!attachmentData.content && (attachmentData.mimeType === 'application/pdf' || attachmentData.mimeType === 'text/plain' || attachmentData.mimeType === 'application/vnd.google-apps.document')) {
          setPickerError(`Content preview/fetch failed for ${attachmentData.name}. It will be sent as a reference. Attempting to send anyway.`);
          // Even if content fetch failed for these types, proceed to send metadata for backend processing.
        }
        // Immediately process and upload the attachment
        await processAndUploadAttachment(attachmentData);
      } else {
        setPickerError("Failed to process selected file from Google Drive. Please try again.");
      }
    } else if (data.action === window.google.picker.Action.CANCEL) {
      console.log('[ChatWindow] Google Picker selection cancelled by user.');
      setPickerError(null); // Clear error if user just cancels
    } else {
      console.log("[ChatWindow] Unknown Picker action:", data.action, data);
    }
  };

  // Create and show Google Picker
  const createPicker = () => {
    if (!(session as any)?.accessToken || !apiKey) {
      setPickerError("Google Drive access is not available: Missing API key or access token.");
      console.error("[ChatWindow] Picker creation failed: API key or access token missing.", { apiKey: !!apiKey, token: !!(session as any)?.accessToken });
      setPickerLoading(false);
      if (!(session as any)?.accessToken && authStatus !== 'loading') {
        signIn('google', { callbackUrl: window.location.href }); // Ensure Drive scopes are requested
      }
      return;
    }
    const view = new window.google.picker.DocsView()
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false)
      .setMode(window.google.picker.DocsViewMode.LIST)
      .setMimeTypes('application/vnd.google-apps.document,application/pdf,text/plain,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    
    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken((session as any).accessToken) // Use the accessToken from NextAuth session
      .setDeveloperKey(apiKey)
      .setCallback(pickerCallback)
      .setTitle('Select Document or Image to Upload to Support AI')
      .setMaxItems(1)
      .build();
    picker.setVisible(true);
    setPickerLoading(false); // Picker is now built and should be visible
  };

  // Handler for Drive Icon click in ChatInput
  const handleDriveIconClickInChat = () => {
    setPickerError(null);
    if (authStatus === 'unauthenticated') {
      signIn('google', { callbackUrl: window.location.href }); // Prompt sign-in if not authenticated at all
      return;
    }
    if (authStatus === 'authenticated' && !(session as any)?.accessToken) {
        // Authenticated with NextAuth, but Google access token might be missing (e.g. scopes not granted, error in token storage)
        console.warn("[ChatWindow] User authenticated but Google access token missing. Re-initiating sign-in for Drive scopes.");
        signIn('google', { callbackUrl: window.location.href }); // Re-prompt to ensure Drive scopes are granted
        return;
    }
    if (authStatus === 'authenticated' && (session as any)?.accessToken) {
        setPickerLoading(true); // Indicate picker is about to load
        loadPickerScript(createPicker);
    } else if (authStatus === 'loading') {
        setPickerError("Authenticating... Please wait before accessing Drive.");
    }
  };

  // Handler for removing staged attachment preview
  const handleRemoveAttachmentInChat = () => {
    setAttachmentForSend(null);
    setPickerError(null);
  };

  // Main function to handle sending messages (primarily text now)
  const handleSendMessage = async (inputText: string) => {
    // Attachment handling is now primarily triggered by pickerCallback via processAndUploadAttachment.
    // If attachmentForSend still holds a value here (e.g., if an immediate upload failed and user retries via send button),
    // we could re-trigger processAndUploadAttachment. However, for simplicity with the new immediate flow,
    // let's assume if pickerCallback succeeded, attachmentForSend is cleared by processAndUploadAttachment.
    // If pickerCallback failed and left attachmentForSend, the user would see an error and might click Drive again.
    // So, this function will now focus on text messages.

    const localAttachmentForSend = attachmentForSend; 
    if (localAttachmentForSend) {
        // If an attachment is somehow still staged and the user hits send with text,
        // prioritize sending the text for now and let the user re-initiate attachment if needed.
        // Or, you could design it to send both, but that complicates the API endpoint.
        // For this refactor, we assume pickerCallback handles the upload path.
        // If the user *manually* clicks send while an attachment preview (from a failed auto-upload) is visible,
        // we can try re-processing it.
        console.log("[ChatWindow] Send button clicked with a staged attachment. Re-attempting upload.");
        await processAndUploadAttachment(localAttachmentForSend);
        // If there was also inputText, we might want to send it after the attachment attempt, or ignore it for this action.
        // For now, if an attachment is present, this action will focus on it.
        // If inputText is also there, it won't be sent in this specific call if an attachment is re-processed.
        // Consider clearing inputText or handling it separately if this mixed scenario is common.
        return; // Return after attempting to process the attachment.
    }

    const trimmedInputText = inputText.trim();
    if (trimmedInputText !== '') {
      setIsLoading(true); 

      const newUserMessage: Message = {
        id: String(Date.now()),
        text: trimmedInputText,
        sender: 'user',
        timestamp: new Date(),
      };
      setMessages(prevMessages => [...prevMessages, newUserMessage]);
      
      try {
        console.log('[ChatWindow] Sending to /api/support-ai/chat, message:', trimmedInputText);

        // Prepare conversation history
        const historyForAPI = messages
          .slice(-MAX_CONVERSATION_HISTORY) 
          .map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
          }));
        
        const apiRequestBody = {
          message: trimmedInputText,
          conversationHistory: historyForAPI 
        };
        console.log('[ChatWindow] Request body for chat API:', apiRequestBody);

        const response = await fetch('/api/support-ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiRequestBody),
        });

        console.log('[ChatWindow] Response status from /api/support-ai/chat:', response.status, response.statusText);
        const result = await response.json(); 
        console.log('[ChatWindow] Response JSON from /api/support-ai/chat:', result);

        if (response.ok && result.answer) {
          const botResponse: Message = { 
            id: String(Date.now() + 1), 
            text: result.answer,
            sender: 'bot', 
            timestamp: new Date(),
            name: 'Support AI',
          };
          setMessages(prevMessages => [...prevMessages, botResponse]);
        } else {
          const errorMessage = result.error || result.message || `Sorry, I had trouble getting a response (Status: ${response.status}).`;
          const errorBotResponse: Message = { 
            id: String(Date.now() + 1),
            text: errorMessage,
            sender: 'system', 
            timestamp: new Date(),
            name: 'System Error',
          };
          setMessages(prevMessages => [...prevMessages, errorBotResponse]);
          console.error('[ChatWindow] Error from /api/support-ai/chat API:', errorMessage);
        }
      } catch (error: any) { 
        console.error('[ChatWindow] Network or other error sending chat message:', error);
        const networkErrorResponse: Message = { 
          id: String(Date.now() + 1),
          text: `Network error: ${error.message || 'Could not connect to the server.'}`,
          sender: 'system',
          timestamp: new Date(),
          name: 'Network Error',
        };
        setMessages(prevMessages => [...prevMessages, networkErrorResponse]);
      }
      setIsLoading(false);
    } else if (trimmedInputText === '') {
        console.log('[ChatWindow] Send called with no attachment and no input text.');
    }
  };


  return (
    <div className="relative flex flex-col h-[calc(100vh-200px)] max-h-[850px] w-full max-w-3xl mx-auto bg-gray-800 shadow-2xl rounded-xl overflow-hidden border border-gray-700">
      {/* Chat Header */}
      <header className="bg-gray-700 p-4 text-white flex items-center shadow-md">
        <FaUserCircle className="w-10 h-10 rounded-full mr-3 text-sky-400" />
        <div>
          <h2 className="text-lg font-semibold text-sky-300">Support AI Chat</h2>
          <p className="text-xs text-gray-400">
            {authStatus === 'loading' && 'Authenticating...'}
            {authStatus === 'unauthenticated' && 'Not signed in (Drive features limited)'}
            {authStatus === 'authenticated' && (session?.user?.name || 'Online')}
            {pickerError && <span className="block text-red-400 mt-1 text-xs">Picker: {pickerError}</span>}
            {(pickerLoading) && 
              <span className="block text-sky-300 mt-1 text-xs animate-pulse">
                Loading Google Picker...
              </span>
            }
          </p>
        </div>
        {/* Button to open Document Manager Modal - REMOVED FROM HEADER */}
      </header>

      {/* Document Manager Modal */}
      <DocumentManagerModal 
        isOpen={isDocManagerOpen} 
        onClose={() => setIsDocManagerOpen(false)} 
        onAddFilesClick={handleDriveIconClickInChat} // Pass the handler here
      />

      {/* Messages Area */}
      <div className="flex-grow p-4 md:p-6 space-y-4 overflow-y-auto bg-slate-800 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-slate-800 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} /> {/* For auto-scrolling */}
      </div>
      
      {/* Typing indicator for AI response */}
      {isLoading && !attachmentForSend && ( // Show typing only for chat responses, not during doc upload
        <div className="px-6 py-2 text-sm text-gray-400 italic">
          Support AI is typing...
        </div>
      )}
       {/* Loading indicator specifically for document upload (if attachmentForSend was just processed) */}
      {isLoading && attachmentForSend && (
         <div className="px-6 py-2 text-sm text-gray-400 italic">
          Processing document upload...
        </div>
      )}

      {/* REMOVED previous button location */}

      {/* Input Area - The FAB will be positioned relative to the main ChatWindow container, appearing above this section */}
      <ChatInput 
        onSendMessage={handleSendMessage} 
        isLoading={isLoading || pickerLoading || authStatus === 'loading'} // General loading state for ChatInput
        attachmentPreview={attachmentForSend}
        onRemoveAttachment={handleRemoveAttachmentInChat}
        onDriveClick={handleDriveIconClickInChat}
        hasAttachment={!!attachmentForSend}
        isDrivePickerLoading={pickerLoading} // Specific loading for Drive button
      />

      {/* FAB-style Button to open Document Manager Modal */}
      <button
        onClick={() => setIsDocManagerOpen(true)}
        className="absolute z-10 bottom-24 right-6 bg-sky-500 hover:bg-sky-600 text-white p-4 rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-opacity-75"
        title="Manage Uploaded Documents"
        aria-label="Manage uploaded documents"
      >
        <FiFolder size={24} />
      </button>
    </div>
  );
}