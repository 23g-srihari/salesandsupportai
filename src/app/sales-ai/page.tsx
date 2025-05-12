'use client';

import { useState } from 'react';
import SearchBar from '@/app/sales-ai/components/SearchBar';
import SearchResults from '@/app/sales-ai/components/SearchResults';
import SearchFilters from '@/app/sales-ai/components/SearchFilters';
import { SearchResult } from '@/app/sales-ai/types';
import DriveFiles from '@/app/components/DriveFiles';

interface FilterState {
  priceRange: [number, number];
  sortBy: 'price' | 'date' | 'rating';
  sortOrder: 'asc' | 'desc';
}

export default function SalesAI() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [originalResults, setOriginalResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [currentQuery, setCurrentQuery] = useState('');
  const [currentFilters, setCurrentFilters] = useState<FilterState>({
    priceRange: [0, 1000],
    sortBy: 'price',
    sortOrder: 'asc'
  });
  const [showDriveFiles, setShowDriveFiles] = useState(false);
  const [userRequestedCount, setUserRequestedCount] = useState(6); // State for user's desired count, now default 6

  const handleSearch = async (query: string, documentId?: string) => {
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setCurrentQuery(query);

    const startTime = performance.now();

    try {
      const payload: any = {
        query,
        filters: currentFilters,
        requestedMatchCount: userRequestedCount // Send the user's desired count
      };

      if (documentId) {
        payload.documentId = documentId;
      }

      const response = await fetch('/api/sales-ai/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch results');
      }

      if (!data.results || !Array.isArray(data.results)) {
        throw new Error('Invalid response format from server');
      }

      setOriginalResults(data.results);
      setResults(data.results);
    } catch (error) {
      setResults([]);
      setOriginalResults([]);
      setError('Unable to process your search at the moment. Please try again later.');
    } finally {
      setIsLoading(false);
      const endTime = performance.now();
      setSearchTime((endTime - startTime) / 1000);
    }
  };

  const handleFilterChange = (filters: FilterState) => {
    setCurrentFilters(filters);

    let filteredResults = [...originalResults];

    filteredResults = filteredResults.filter(result =>
      result.price.amount >= filters.priceRange[0] &&
      result.price.amount <= filters.priceRange[1]
    );

    filteredResults.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'price':
          comparison = a.price.amount - b.price.amount;
          break;
        case 'rating':
          comparison = a.rating - b.rating;
          break;
        case 'date':
          comparison = new Date(a.price.saleEndsAt || 0).getTime() - new Date(b.price.saleEndsAt || 0).getTime();
          break;
      }
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    setResults(filteredResults);
  };

  return (
    <div className={`bg-gray-900 text-gray-100 ${!hasSearched ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${!hasSearched ? 'flex flex-col items-center justify-start h-full pt-24' : 'py-8'}`}>
        <div className={`text-center ${!hasSearched ? 'mb-8' : 'mb-12'}`}>
          <h1 className="text-4xl font-bold text-gray-100 mb-2">Sales AI</h1>
        </div>

        <div className={`w-full max-w-4xl mx-auto ${!hasSearched ? '' : 'mb-12'}`}>
          <SearchBar onSearch={handleSearch} isLoading={isLoading} onDriveClick={() => setShowDriveFiles(true)} />
        </div>

        {showDriveFiles && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
            <DriveFiles onClose={() => setShowDriveFiles(false)} />
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-900/50 text-red-200 rounded-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {hasSearched && (
          <div className="mb-8">
            <SearchFilters
              totalResults={results.length}
              searchTime={searchTime}
              onFilterChange={handleFilterChange}
            />
          </div>
        )}

        <div className="mt-8">
          <SearchResults
            results={results}
            isLoading={isLoading}
            hasSearched={hasSearched}
            onProductSelect={(product) => {
              // console.log('Selected product:', product);
            }}
          />
        </div>
      </div>
    </div>
  );
}