// src/app/support-ai/page.tsx
'use client'; // <--- Add this directive
import React from 'react';
import ChatWindow from './components/ChatWindow'; // Import the ChatWindow component

export default function SupportAIPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-gray-100 flex flex-col items-center pt-8 md:pt-12 lg:pt-16 px-4 pattern-bg">
      <header className="mb-8 md:mb-12 text-center w-full max-w-2xl">
        <h1 className="text-4xl font-extrabold text-sky-300 sm:text-5xl tracking-tight">
          Support AI
        </h1>
      </header>
      
      {/* ChatWindow will be centered due to its own mx-auto and max-w-2xl */}
      <ChatWindow /> 

      {/* Style for a subtle pattern background (optional) */}
      {/* You would need to create this pattern or choose a color */}
      {/* For example, a very subtle dot pattern or a specific green if you want to mimic WA closely */}
      <style jsx global>{`
        .pattern-bg {
          /* background-image: url('/whatsapp-bg-pattern.png'); */ /* Example: if you have a pattern image */
          /* background-repeat: repeat; */
        }
      `}</style>
    </div>
  );
}
