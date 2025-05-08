'use client';

import { useState } from 'react';
import AnimatedPlaceholder from './AnimatedPlaceholder';
import { SiGoogledrive } from 'react-icons/si';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  onDriveClick?: () => void;
}

export default function SearchBar({ onSearch, isLoading, onDriveClick }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  interface SearchResult {
    id: string;
    name: string;
    description?: string;
  }

  const handleProductSelect = (product: SearchResult) => {
    // Implement your logic here, e.g., open a modal, log, etc.
    console.log('Selected product:', product);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
      <div className="relative flex items-center">
        <div className={`absolute left-6 text-gray-400 dark:text-gray-500 ${isFocused ? 'text-blue-500 dark:text-blue-400' : ''}`}>
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={query ? '' : undefined}
          className="w-full pl-16 pr-12 py-4 text-xl rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 shadow-sm transition-all"
        />
        {!query && (
          <div className="absolute left-16 text-gray-400 dark:text-gray-500 pointer-events-none">
            <AnimatedPlaceholder />
          </div>
        )}
        {!isLoading && (
          <button
            type="button"
            className="absolute right-16 p-2 mr-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400 focus:outline-none"
            title="Attach from Google Drive"
            onClick={onDriveClick}
          >
            <SiGoogledrive className="w-7 h-7" />
          </button>
        )}
        {!isLoading && (
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="absolute right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            )}
          </button>
        )}
      </div>
    </form>
  );
}