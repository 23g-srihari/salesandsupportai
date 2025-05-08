'use client';

import { SearchResult } from '../types';
import { useState } from 'react';
import AIRecommendation from './AIRecommendation';

// Add styles to hide scrollbar
const styles = `
  .scrollbar-hide {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;  /* Chrome, Safari and Opera */
  }
`;

interface CompareProductsProps {
  results: SearchResult[];
}

interface Question {
  id: string;
  text: string;
  options: string[];
}

const questions: Question[] = [
  {
    id: 'budget',
    text: 'What is your budget range?',
    options: ['Under $100', '$100-$200', '$200-$500', 'Above $500']
  },
  {
    id: 'usage',
    text: 'How will you primarily use this product?',
    options: ['Personal Use', 'Professional Use', 'Gaming', 'Business']
  },
  {
    id: 'priority',
    text: 'What is most important to you?',
    options: ['Performance', 'Price', 'Features', 'Quality']
  },
  {
    id: 'experience',
    text: 'What is your experience level?',
    options: ['Beginner', 'Intermediate', 'Advanced', 'Expert']
  }
];

export default function CompareProducts({ results }: CompareProductsProps) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [showAIRecommendation, setShowAIRecommendation] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [recommendation, setRecommendation] = useState<SearchResult | null>(null);
  const [hasViewedComparison, setHasViewedComparison] = useState(false);

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      }
      if (prev.length < 3) {
        return [...prev, productId];
      }
      return prev;
    });
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

  const selectedProductsData = results.filter(product => selectedProducts.includes(product.id));

  const handleAnswer = (answer: string) => {
    const currentQuestion = questions[currentQuestionIndex];
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: answer
    }));

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // Generate recommendation based on answers
      generateRecommendation();
    }
  };

  const generateRecommendation = () => {
    // This is a simplified recommendation logic
    // In a real application, this would use a more sophisticated algorithm
    const selectedProductsData = results.filter(product => selectedProducts.includes(product.id));
    
    // Example scoring logic based on answers
    const scores = selectedProductsData.map(product => {
      let score = 0;
      
      // Budget consideration
      const budget = answers.budget;
      const price = product.price.amount;
      if (budget === 'Under $100' && price < 100) score += 3;
      else if (budget === '$100-$200' && price >= 100 && price <= 200) score += 3;
      else if (budget === '$200-$500' && price > 200 && price <= 500) score += 3;
      else if (budget === 'Above $500' && price > 500) score += 3;

      // Usage consideration
      const usage = answers.usage;
      if (usage === 'Professional Use' && product.features.some(f => f.name.toLowerCase().includes('professional'))) score += 2;
      if (usage === 'Gaming' && product.features.some(f => f.name.toLowerCase().includes('gaming'))) score += 2;

      // Priority consideration
      const priority = answers.priority;
      if (priority === 'Performance' && product.rating >= 4) score += 2;
      if (priority === 'Price' && product.price.isOnSale) score += 2;
      if (priority === 'Features' && product.features.length > 3) score += 2;
      if (priority === 'Quality' && product.rating >= 4.5) score += 2;

      // Experience level consideration
      const experience = answers.experience;
      if (experience === 'Beginner' && product.features.some(f => f.name.toLowerCase().includes('easy'))) score += 1;
      if (experience === 'Expert' && product.features.some(f => f.name.toLowerCase().includes('advanced'))) score += 1;

      return { product, score };
    });

    // Get the product with the highest score
    const bestMatch = scores.reduce((prev, current) => 
      current.score > prev.score ? current : prev
    );

    setRecommendation(bestMatch.product);
  };

  const handleComparisonClose = () => {
    setShowComparison(false);
  };

  const handleComparisonOpen = () => {
    setShowComparison(true);
    setHasViewedComparison(true);
  };

  const renderComparisonView = () => {
    if (!showComparison) return null;

    return (
      <div className="fixed inset-0 bg-black/80 z-50">
        <style>{styles}</style>
        <div className="h-screen p-6">
          <div className="max-w-7xl mx-auto bg-gray-800 rounded-lg shadow-xl h-[calc(100vh-3rem)] overflow-y-auto scrollbar-hide">
            <div className="p-6 flex justify-between items-start">
              <h2 className="text-2xl font-semibold text-gray-100">Product Comparison</h2>
              <div className="flex flex-col items-end gap-4">
                <button
                  onClick={handleComparisonClose}
                  className="text-gray-400 hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {hasViewedComparison && (
                  <button
                    onClick={() => setShowAIRecommendation(true)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-300"
                  >
                    <span>Get AI Recommendation</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {selectedProductsData.map((product) => (
                  <div key={product.id} className="bg-gray-700/50 rounded-lg p-6">
                    <div className="aspect-w-16 aspect-h-9 mb-4">
                      <img
                        src={getImageUrl(product.imageUrl)}
                        alt={product.title}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-100 mb-2">
                      {product.title.split('(')[0].trim()}
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-1">Price</h4>
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-bold ${
                            product.price.isOnSale ? 'text-emerald-400' : 'text-gray-100'
                          }`}>
                            {product.price.currency} {product.price.amount.toFixed(2)}
                          </span>
                          {product.price.isOnSale && product.price.originalPrice && (
                            <span className="text-sm text-gray-400 line-through">
                              {product.price.currency} {product.price.originalPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-1">Category</h4>
                        <span className="px-2 py-1 rounded-full text-sm bg-blue-900/50 text-blue-300">
                          {product.category}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-1">Description</h4>
                        <p className="text-gray-300">{product.description}</p>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-1">Key Features</h4>
                        <div className="space-y-2">
                          {product.features.map((feature, index) => (
                            <div key={index} className="bg-gray-800/50 p-3 rounded-lg">
                              <h5 className="font-medium text-gray-100 mb-1">{feature.name}</h5>
                              <p className="text-sm text-gray-400">{feature.description}</p>
                              <p className="text-sm text-blue-400 mt-1">
                                <span className="font-medium">Benefit:</span> {feature.benefit}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-400 mb-1">Pros</h4>
                          <ul className="space-y-1">
                            {product.pros?.map((pro, index) => (
                              <li key={index} className="flex items-start text-sm">
                                <svg className="w-4 h-4 text-emerald-400 mr-1 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="text-emerald-300">{pro}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-400 mb-1">Cons</h4>
                          <ul className="space-y-1">
                            {product.cons?.map((con, index) => (
                              <li key={index} className="flex items-start text-sm">
                                <svg className="w-4 h-4 text-red-400 mr-1 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span className="text-red-300">{con}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-1">Rating</h4>
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <svg
                                key={i}
                                className={`w-5 h-5 ${
                                  i < Math.floor(product.rating)
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
                          <span className="text-gray-400">({product.rating.toFixed(1)})</span>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-1">Stock Status</h4>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          product.stockStatus === 'in_stock'
                            ? 'bg-emerald-900/50 text-emerald-300'
                            : 'bg-red-900/50 text-red-300'
                        }`}>
                          {product.stockStatus === 'in_stock' ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-1">Why Buy This</h4>
                        <p className="text-blue-300">{product.whyBuy || 'No purchase recommendation available.'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="border-2 border-gray-700 rounded-lg shadow-sm p-6">
      <div className="relative mb-6">
        <div className="flex flex-col items-start">
          <h2 className="text-xl font-semibold text-gray-100 mb-2">Compare Products</h2>
          <p className="text-sm text-gray-400">
            {selectedProducts.length === 3 ? (
              <span className="text-emerald-400">Maximum 3 products selected</span>
            ) : (
              `Select ${selectedProducts.length < 2 ? '2-3' : 'up to 3'} products to compare`
            )}
          </p>
        </div>
        {selectedProducts.length > 0 && (
          <button
            onClick={() => setSelectedProducts([])}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-sm text-gray-400 hover:text-gray-300 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map((result) => {
          const imageUrl = getImageUrl(result.imageUrl);
          const isSelected = selectedProducts.includes(result.id);
          const showSelectionButton = selectedProducts.length < 3 || isSelected;
          const isDisabled = selectedProducts.length === 3 && !isSelected;
          
          return (
            <div
              key={result.id}
              className={`bg-gray-800 rounded-lg shadow-md transition-all duration-300 ${
                isDisabled 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:shadow-lg cursor-pointer'
              } ${isSelected ? 'ring-2 ring-emerald-500' : ''}`}
            >
              <div className="relative border border-gray-700 rounded-t-lg overflow-hidden m-4">
                <img
                  src={imageUrl}
                  alt={result.title}
                  className="w-full object-cover h-48"
                />
                {showSelectionButton && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleProduct(result.id);
                    }}
                    className={`absolute top-2 right-2 p-2 rounded-full transition-all ${
                      isSelected
                        ? 'bg-emerald-500/80 hover:bg-emerald-500'
                        : 'bg-gray-900/80 hover:bg-gray-800'
                    }`}
                  >
                    {isSelected ? (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold line-clamp-1 text-gray-100 text-base">
                    {result.title.split('(')[0].trim()}
                  </h3>
                  <span className={`font-bold text-lg ${
                    result.price.isOnSale ? 'text-emerald-400' : 'text-gray-100'
                  }`}>
                    {result.price.currency} {result.price.amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 rounded-full text-xs bg-blue-900/50 text-blue-300">
                    {result.category}
                  </span>
                </div>
                <p className="text-gray-400 line-clamp-2 text-sm">
                  {result.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {selectedProducts.length >= 2 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2">
          <button
            onClick={handleComparisonOpen}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 rounded-full shadow-lg flex items-center gap-2 transition-all duration-300"
          >
            <span>Compare {selectedProducts.length} Products</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {renderComparisonView()}
      <AIRecommendation
        show={showAIRecommendation}
        onClose={() => setShowAIRecommendation(false)}
        selectedProducts={selectedProductsData}
      />
    </div>
  );
} 