// src/app/support-ai/components/MessageBubble.tsx
'use client';

import React, { useState, useEffect } from 'react'; // Added useState, useEffect
import { Message } from './ChatWindow'; // Import the Message type
import { FaUserCircle, FaRobot } from 'react-icons/fa'; // Example icons

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === 'user';
  const isSystem = message.sender === 'system';

  // WhatsApp-like colors (can be customized)
  const userBubbleColor = 'bg-gradient-to-br from-green-500 to-green-600'; // Example: User's messages
  const supportBubbleColor = 'bg-gray-700'; // Example: Support/bot messages
  const systemMessageColor = 'text-xs text-center text-gray-400 my-2 py-1';

  if (isSystem) {
    return (
      <div className={systemMessageColor}>
        <p>{message.text}</p>
      </div>
    );
  }

  const bubbleAlignment = isUser ? 'justify-end' : 'justify-start';
  const bubbleSpecificColor = isUser ? userBubbleColor : supportBubbleColor;
  const textAlign = isUser ? 'text-right' : 'text-left';
  const nameAlign = isUser ? 'text-right mr-2' : 'text-left ml-2';

  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Tail for the bubble (simple CSS triangle, can be enhanced with SVG or more complex CSS)
  // Not implementing full WhatsApp tails here for brevity, but focusing on color and alignment.

  return (
    <div className={`flex ${bubbleAlignment} w-full`}>
      <div className={`flex items-end max-w-[70%] md:max-w-[65%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
          <div className="mr-2 mb-1 self-end">
            {message.avatar ? (
              <img src={message.avatar} alt={message.name || 'avatar'} className="w-6 h-6 rounded-full" />
            ) : message.sender === 'support' ? (
              <FaRobot className="w-6 h-6 text-sky-400 rounded-full bg-gray-600 p-0.5" />
            ) : (
              <FaUserCircle className="w-6 h-6 text-gray-400" />
            )}
          </div>
        )}
        <div className="flex flex-col">
            {!isUser && message.name && (
                <p className={`text-xs text-gray-400 mb-0.5 ${isUser ? 'self-end' : 'self-start'} px-1`}>
                    {message.name}
                </p>
            )}
            {/* Bubble with tail container */}
            <div className="relative group">
              <div
                className={`px-4 py-2 rounded-xl shadow ${bubbleSpecificColor} text-white break-words`}
                style={{ 
                    borderBottomRightRadius: isUser ? '4px' : '16px', 
                    borderBottomLeftRadius: isUser ? '16px' : '4px',
                }} 
              >
                <p className={`whitespace-pre-wrap ${textAlign}`}>{message.text}</p>
              </div>
              {/* Tail (simple CSS triangle using borders on an absolutely positioned empty div) */}
              {isUser ? (
                // Refined Tail for user: smaller, slightly different position for rounded-xl
                <div 
                  className="absolute right-[-5px] bottom-[5px] w-0 h-0"
                  style={{
                    borderTop: '6px solid transparent',
                    borderBottom: '6px solid transparent',
                    borderLeft: '8px solid #10B981', // Approx from-green-600
                  }}
                ></div>
              ) : (
                // Refined Tail for support: smaller, slightly different position for rounded-xl
                <div 
                  className="absolute left-[-5px] bottom-[5px] w-0 h-0"
                  style={{
                    borderTop: '6px solid transparent',
                    borderBottom: '6px solid transparent',
                    borderRight: '8px solid #374151', // bg-gray-700
                  }}
                ></div>
              )}
            </div>
            <p className={`text-xs text-gray-500 mt-1 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
            {isClient ? message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
            </p>
        </div>
      </div>
    </div>
  );
}
