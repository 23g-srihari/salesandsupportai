'use client';

import { SearchResult } from '../types';
import { useState } from 'react';
import CompareProducts from './CompareProducts';
import SendPersonalizedMail from './SendPersonalizedMail';

interface SearchResultsProps {
  results: SearchResult[];
  isLoading: boolean;
  hasSearched: boolean;
  onProductSelect: (product: SearchResult) => void;
}

const DEFAULT_IMAGE = 'https://placehold.co/400x300/e2e8f0/64748b?text=Product+Image';

export default function SearchResults({ results, isLoading, hasSearched, onProductSelect }: SearchResultsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SearchResult | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Debug log to check incoming data
  // console.log('SearchResults received:', results);

  const handleCardClick = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getImageUrl = (url: string | undefined) => {
    if (!url) return DEFAULT_IMAGE;
    try {
      const imageUrl = new URL(url);
      return imageUrl.protocol === 'https:' ? url : DEFAULT_IMAGE;
    } catch {
      return DEFAULT_IMAGE;
    }
  };

  const handleEmailClick = (product: SearchResult) => {
    setSelectedProduct(product);
    setShowEmailModal(true);
  };

  if (isLoading) {
    return (
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-gray-800 rounded-lg p-4 shadow-md">
            <div className="h-48 bg-gray-700 rounded-lg mb-4"></div>
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  if (hasSearched && (!results || results.length === 0)) {
    return (
      <div className="mt-8 text-center text-gray-400">
        <p className="text-lg">No results found. Try a different search query.</p>
      </div>
    );
  }

  if (!results || results.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          title={showComparison ? "Show Search Results" : "Compare Products"}
        >
          {showComparison ? (
            <>
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="text-gray-300">Show Results</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-gray-300">Compare Products</span>
            </>
          )}
        </button>
      </div>

      {showComparison ? (
        <CompareProducts results={results} />
      ) : (
        <div className="border-2 border-gray-700 rounded-lg shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((result) => {
              // Debug log for each result
              // console.log('Processing result:', result);
              
              const isExpanded = expandedId === result.id;
              const imageUrl = getImageUrl(result.imageUrl);
              
              return (
                <div
                  key={result.id}
                  onClick={() => handleCardClick(result.id)}
                  className={`bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer ${
                    isExpanded 
                      ? 'md:col-span-2 md:row-span-2' 
                      : expandedId 
                        ? 'opacity-50' 
                        : ''
                  }`}
                >
                  <div className="relative border border-gray-700 rounded-t-lg overflow-hidden m-4">
                    <img
                      src={imageUrl}
                      alt={result.title}
                      className={`w-full object-cover transition-all duration-300 ${
                        isExpanded ? 'h-64' : 'h-48'
                      }`}
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`font-semibold line-clamp-1 text-gray-100 ${
                        isExpanded ? 'text-xl' : 'text-base'
                      }`}>
                        {result.title.split('(')[0].trim()}
                      </h3>
                      <span className={`font-bold ${
                        isExpanded ? 'text-2xl' : 'text-lg'
                      } ${result.price.isOnSale ? 'text-emerald-400' : 'text-gray-100'}`}>
                        {result.price.currency} {result.price.amount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded-full ${
                        isExpanded ? 'text-sm' : 'text-xs'
                      } bg-blue-900/50 text-blue-300`}>
                        {result.category}
                      </span>
                    </div>
                    <p className={`text-gray-400 line-clamp-2 ${
                      isExpanded ? 'text-base' : 'text-sm'
                    }`}>
                      {result.description}
                    </p>

                    {isExpanded && (
                      <div className="mt-4 space-y-4">
                        {result.price.isOnSale && (
                          <div className="bg-emerald-900/30 p-4 rounded-lg">
                            <div className="flex justify-between items-center">
                              <div>
                                {result.price.originalPrice && (
                                  <div className="text-sm text-gray-400 line-through">
                                    Original: {result.price.currency} {result.price.originalPrice.toFixed(2)}
                                  </div>
                                )}
                                {result.price.discountAmount && result.price.discount && (
                                  <div className="text-emerald-400 font-medium">
                                    Save {result.price.currency} {result.price.discountAmount.toFixed(2)} ({result.price.discount}% off)
                                  </div>
                                )}
                              </div>
                              {result.price.saleEndsAt && (
                                <div className="text-sm text-gray-400">
                                  Sale ends {new Date(result.price.saleEndsAt).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div>
                          <h3 className="text-lg font-medium text-gray-100 mb-3">Key Features</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {result.features.map((feature, index) => (
                              <div key={index} className="bg-gray-700/50 p-4 rounded-lg">
                                <h4 className="font-medium text-gray-100 mb-1">{feature.name}</h4>
                                <p className="text-gray-400 text-sm mb-1">{feature.description}</p>
                                <p className="text-blue-400 text-sm">
                                  <span className="font-medium">Benefit:</span> {feature.benefit}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-emerald-900/30 p-4 rounded-lg">
                            <h3 className="text-lg font-medium text-emerald-400 mb-3">Pros</h3>
                            <ul className="space-y-2">
                              {result.pros?.map((pro, index) => (
                                <li key={index} className="flex items-start">
                                  <svg className="w-5 h-5 text-emerald-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span className="text-emerald-300">{pro}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="bg-red-900/30 p-4 rounded-lg">
                            <h3 className="text-lg font-medium text-red-400 mb-3">Cons</h3>
                            <ul className="space-y-2">
                              {result.cons?.map((con, index) => (
                                <li key={index} className="flex items-start">
                                  <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  <span className="text-red-300">{con}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="bg-blue-900/30 p-6 rounded-lg">
                          <h3 className="text-xl font-medium text-blue-400 mb-3">Why You Should Buy This</h3>
                          <p className="text-blue-300 leading-relaxed">
                            {result.whyBuy || 'No purchase recommendation available.'}
                          </p>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex items-center">
                              {[...Array(5)].map((_, i) => (
                                <svg
                                  key={i}
                                  className={`w-5 h-5 ${
                                    i < Math.floor(result.rating)
                                      ? 'text-yellow-400'
                                      : 'text-gray-600'
                                  }`}
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                            <span className="text-gray-400 text-sm ml-2">({result.rating.toFixed(1)})</span>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEmailClick(result);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors duration-300"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Send Email
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showEmailModal && selectedProduct && (
        <SendPersonalizedMail
          recommendedProduct={selectedProduct}
          userPreferences={{
            questions: [],
            answers: {}
          }}
          onClose={() => {
            setShowEmailModal(false);
            setSelectedProduct(null);
          }}
        />
      )}
    </div>
  );
} 