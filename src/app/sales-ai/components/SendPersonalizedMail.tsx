'use client';

import { SearchResult } from '../types';
import { useState } from 'react';

interface SendPersonalizedMailProps {
  recommendedProduct: SearchResult;
  userPreferences: {
    questions: { id: string; text: string }[];
    answers: Record<string, string>;
  };
  onClose: () => void;
}

export default function SendPersonalizedMail({ recommendedProduct, userPreferences, onClose }: SendPersonalizedMailProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setError(null);

    try {
      const response = await fetch('/api/sales-ai/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          name,
          product: recommendedProduct,
          preferences: userPreferences
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  const getImageUrl = (url: string | undefined) => {
    const DEFAULT_IMAGE = 'https://placehold.co/400x300/e2e8f0/64748b?text=Product+Image';
    if (!url) return DEFAULT_IMAGE;
    try {
      const imageUrl = new URL(url);
      return imageUrl.protocol === 'https:' ? url : DEFAULT_IMAGE;
    } catch {
      return DEFAULT_IMAGE;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl p-4 max-w-md w-full mx-2 relative shadow-2xl border border-gray-700/50 flex flex-col items-center justify-center min-h-[320px]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-300 transition-colors duration-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-100 mb-2">Send Personalized Email</h2>
          <p className="text-gray-400 text-sm">We'll send you detailed information about your recommended product</p>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-scale">
              <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-emerald-400 text-xl font-medium mb-2">Email sent successfully!</p>
            <p className="text-gray-400 text-sm">Check your inbox for your personalized recommendation</p>
          </div>
        ) : (
          <>
            {/* Product Card */}
            <div className="mb-2 p-2 rounded-2xl bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700 flex flex-row items-center text-left shadow-lg shadow-emerald-900/10 transition-shadow duration-300 min-h-[64px]">
              <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-emerald-500/40 flex items-center justify-center bg-gray-700 mr-3 flex-shrink-0">
                <img
                  src={getImageUrl(recommendedProduct.imageUrl)}
                  alt={recommendedProduct.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <h3 className="text-sm font-semibold text-emerald-300 mb-0.5 line-clamp-1">{recommendedProduct.title}</h3>
                <p className="text-gray-400 text-xs mb-0.5 line-clamp-2 max-w-[220px]">{recommendedProduct.description}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {recommendedProduct.price && (
                    <span className="text-emerald-400 font-bold text-xs">
                      {recommendedProduct.price.currency} {recommendedProduct.price.amount.toFixed(2)}
                      {recommendedProduct.price.isOnSale && (
                        <span className="ml-1 bg-red-500/20 text-red-400 px-1 py-0.5 rounded-full text-[9px] font-semibold">On Sale!</span>
                      )}
                    </span>
                  )}
                  {recommendedProduct.category && (
                    <span className="bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full text-[9px]">{recommendedProduct.category}</span>
                  )}
                </div>
              </div>
            </div>
            {/* End Product Card */}
            <form onSubmit={handleSubmit} className="space-y-4 w-full">
              <div className="space-y-2">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                    Your Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-8 pr-2 py-2 bg-gray-700/50 border border-gray-600 rounded-xl text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-xs transition-all duration-200"
                      placeholder="Enter your name"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Your Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-8 pr-2 py-2 bg-gray-700/50 border border-gray-600 rounded-xl text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-xs transition-all duration-200"
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl animate-shake">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30 text-xs"
                >
                  {isSending ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Email
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
} 