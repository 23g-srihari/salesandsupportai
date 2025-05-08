'use client';

import { useState } from 'react';

interface SearchFiltersProps {
  totalResults: number;
  searchTime: number;
  onFilterChange: (filters: FilterState) => void;
}

interface FilterState {
  priceRange: [number, number];
  sortBy: 'price' | 'date' | 'rating';
  sortOrder: 'asc' | 'desc';
}

export default function SearchFilters({ totalResults, searchTime, onFilterChange }: SearchFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    priceRange: [0, 100000],
    sortBy: 'price',
    sortOrder: 'asc'
  });

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFilterChange(updatedFilters);
    setActiveSubmenu(null);
  };

  const toggleFilter = () => {
    setIsFilterOpen(!isFilterOpen);
    if (!isFilterOpen) {
      setActiveSubmenu(null);
    }
  };

  const toggleSubmenu = (submenu: string) => {
    setActiveSubmenu(activeSubmenu === submenu ? null : submenu);
  };

  if (totalResults === 0) {
    return null;
  }

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
      {/* Results Summary */}
      <div className="flex items-center gap-3 text-emerald-400 text-sm">
        <span className="font-medium">Searched for {totalResults} results in {searchTime.toFixed(2)} seconds</span>
      </div>

      {/* Filter Button and Dropdown */}
      <div className="relative">
        <button
          onClick={toggleFilter}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
          <svg className={`w-4 h-4 ml-1 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isFilterOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
            {/* Price Range Option */}
            <div className="relative">
              <button
                onClick={() => toggleSubmenu('price')}
                className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Price Range
                </span>
                <svg className={`w-4 h-4 transition-transform ${activeSubmenu === 'price' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {activeSubmenu === 'price' && (
                <div className="absolute left-full top-0 ml-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                  {[
                    { label: '₹0 - ₹10,000', value: '0-10000' },
                    { label: '₹10,000 - ₹50,000', value: '10000-50000' },
                    { label: '₹50,000 - ₹1,00,000', value: '50000-100000' },
                    { label: '₹1,00,000 - ₹2,00,000', value: '100000-200000' },
                    { label: '₹2,00,000+', value: '200000-500000' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        const [min, max] = option.value.split('-').map(Number);
                        handleFilterChange({ priceRange: [min, max] });
                      }}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort By Option */}
            <div className="relative">
              <button
                onClick={() => toggleSubmenu('sort')}
                className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                  Sort By
                </span>
                <svg className={`w-4 h-4 transition-transform ${activeSubmenu === 'sort' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {activeSubmenu === 'sort' && (
                <div className="absolute left-full top-0 ml-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                  {[
                    { label: 'Price', value: 'price' },
                    { label: 'Release Date', value: 'date' },
                    { label: 'Rating', value: 'rating' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleFilterChange({ sortBy: option.value as FilterState['sortBy'] })}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort Order Option */}
            <div className="relative">
              <button
                onClick={() => toggleSubmenu('order')}
                className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  Order
                </span>
                <svg className={`w-4 h-4 transition-transform ${activeSubmenu === 'order' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {activeSubmenu === 'order' && (
                <div className="absolute left-full top-0 ml-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                  {[
                    { label: 'Ascending', value: 'asc' },
                    { label: 'Descending', value: 'desc' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleFilterChange({ sortOrder: option.value as FilterState['sortOrder'] })}
                      className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 