// src/app/support-ai/components/ChatWindow.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import ChatInput, { AttachmentPreviewData } from './ChatInput'; // Import AttachmentPreviewData
import { FaUserCircle } from 'react-icons/fa'; // Example icon
// TODO: You might need a component similar to DriveFiles.tsx for Google Drive picking in chat
// For now, we'll assume Drive picking logic will be handled here or by a new component.

// Define a type for message objects
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'support' | 'system'; // 'user' for customer, 'support' for agent/bot
  timestamp: Date;
  avatar?: string; // Optional avatar URL
  name?: string; // Optional sender name
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([
    // Some initial mock messages for UI development
    { id: '1', text: 'Hello! How can I help you today?', sender: 'support', timestamp: new Date(Date.now() - 60000 * 5), name: 'Support Bot' },
    { id: '2', text: 'I\'m having an issue with my recent order.', sender: 'user', timestamp: new Date(Date.now() - 60000 * 4) },
    { id: '3', text: 'I understand. Could you please provide your order number?', sender: 'support', timestamp: new Date(Date.now() - 60000 * 3), name: 'Support Bot' },
    { id: '4', text: 'Sure, it\'s #123456. The item I received is damaged.', sender: 'user', timestamp: new Date(Date.now() - 60000 * 2) },
    { id: '5', text: 'Thank you for that information. I\'m very sorry to hear about the damaged item. Let me look into this for you immediately.', sender: 'support', timestamp: new Date(), name: 'Support Bot' },
  ]);
  const [isLoading, setIsLoading] = useState(false); // For when AI is "typing"
  const [attachmentForSend, setAttachmentForSend] = useState<AttachmentPreviewData | null>(null);

  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleDriveIconClickInChat = () => {
    // TODO: Implement Google Drive Picker logic here.
    // 1. Open Drive Picker (similar to DriveFiles.tsx or a new, simpler one).
    // 2. On file selection, get file name, type, and content (e.g., as dataUrl for images).
    // 3. Call setAttachmentForSend with the selected file data.
    console.log("ChatWindow: Google Drive icon clicked. TODO: Open picker.");
    // For demo purposes, simulating a file selection:
    // This would typically happen in a callback from your Drive picker logic.
    const demoFile: AttachmentPreviewData = {
      name: "demo_image_from_drive.png",
      type: "image/png",
      dataUrl: "https://via.placeholder.com/150/92c952" // Placeholder image
    };
    setAttachmentForSend(demoFile);
  };

  const handleRemoveAttachmentInChat = () => {
    setAttachmentForSend(null);
    console.log("ChatWindow: Attachment removed.");
  };

  const handleSendMessage = (inputText: string, attachment?: AttachmentPreviewData) => {
    if (inputText.trim() === '' && !attachment) return;

    let messageText = inputText;
    if (attachment) {
      // TODO: Handle actual file upload here before sending the message.
      // For now, we just prepend a note about the attachment to the text.
      messageText = `[Attachment: ${attachment.name}] ${inputText}`.trim();
      console.log("ChatWindow: Sending message with attachment:", attachment.name);
    }

    const newMessage: Message = {
      id: String(Date.now()),
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages(prevMessages => [...prevMessages, newMessage]);
    setAttachmentForSend(null); // Clear the preview after sending

    // Simulate bot response (replace with actual API call later)
    setIsLoading(true);
    setTimeout(() => {
      let botResponseText = `I've received your message: "${inputText}".`;
      if (attachment) {
        botResponseText += ` And I see you've attached: ${attachment.name}.`;
      }
      botResponseText += " I am processing your request.";

      const botResponse: Message = {
        id: String(Date.now() + 1),
        text: botResponseText,
        sender: 'support',
        timestamp: new Date(),
        name: 'Support Bot'
      };
      setMessages(prevMessages => [...prevMessages, botResponse]);
      setIsLoading(false);
    }, 1500 + Math.random() * 1000);
  };

  return (
    // Reverted to previous size: Increased max-width and height for a more substantial feel (from 2xl to 3xl, 700px to 850px)
    <div className="flex flex-col h-[calc(100vh-200px)] max-h-[850px] w-full max-w-3xl mx-auto bg-gray-800 shadow-2xl rounded-xl overflow-hidden border border-gray-700">
      {/* Chat Header */}
      <header className="bg-gray-700 p-4 text-white flex items-center shadow-md">
        <FaUserCircle className="w-10 h-10 rounded-full mr-3 text-sky-400" /> {/* Placeholder Icon */}
        <div>
          <h2 className="text-lg font-semibold text-sky-300">Support Chat</h2>
          <p className="text-xs text-gray-400">Online</p> {/* Or agent name, status */}
        </div>
      </header>

      {/* Messages Area - with hidden scrollbar */}
      <div className="flex-grow p-4 md:p-6 space-y-4 overflow-y-auto bg-slate-800 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-slate-800 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} /> {/* For auto-scrolling */}
      </div>
      
      {/* Optional: Typing indicator */}
      {isLoading && (
        <div className="px-6 py-2 text-sm text-gray-400 italic">
          Support is typing...
        </div>
      )}

      {/* Input Area */}
      <ChatInput 
        onSendMessage={handleSendMessage} 
        isLoading={isLoading} 
        attachmentPreview={attachmentForSend}
        onRemoveAttachment={handleRemoveAttachmentInChat}
        onDriveClick={handleDriveIconClickInChat}
      />
    </div>
  );
}
