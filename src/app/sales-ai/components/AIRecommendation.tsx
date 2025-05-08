'use client';

import { SearchResult } from '../types';
import { useState, useEffect } from 'react';
import SendPersonalizedMail from './SendPersonalizedMail';

interface Question {
  id: string;
  text: string;
  options: string[];
}

interface AIRecommendationProps {
  show: boolean;
  onClose: () => void;
  selectedProducts: SearchResult[];
}

export default function AIRecommendation({ show, onClose, selectedProducts }: AIRecommendationProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [recommendation, setRecommendation] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  useEffect(() => {
    if (show && selectedProducts.length > 0) {
      generateQuestions();
    }
  }, [show, selectedProducts]);

  const generateQuestions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/sales-ai/search/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ products: selectedProducts }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate questions');
      }

      const data = await response.json();
      setQuestions(data.questions);
    } catch (err) {
      setError('Failed to generate questions. Please try again.');
      console.error('Error generating questions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    const currentQuestion = questions[currentQuestionIndex];
    const newAnswers = {
      ...answers,
      [currentQuestion.id]: answer
    };
    setAnswers(newAnswers);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      await generateRecommendation(newAnswers);
    }
  };

  const generateRecommendation = async (finalAnswers: Record<string, string>) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/sales-ai/search/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          products: selectedProducts,
          answers: finalAnswers
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate recommendation');
      }

      const data = await response.json();
      const recommendedProduct = selectedProducts.find(
        product => product.id === data.recommendation.recommendedProductId
      );
      
      if (recommendedProduct) {
        setRecommendation(recommendedProduct);
      }
    } catch (err) {
      setError('Failed to generate recommendation. Please try again.');
      console.error('Error generating recommendation:', err);
    } finally {
      setLoading(false);
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

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto">
      <div className="min-h-screen p-6">
        <div className={`max-w-2xl mx-auto bg-gray-800 rounded-lg shadow-xl ${recommendation ? 'overflow-hidden' : ''}`}>
          <div className="p-6 border-b border-gray-700 flex justify-between items-center">
            <h2 className="text-2xl font-semibold text-gray-100">AI Product Recommendation</h2>
            <button
              onClick={() => {
                onClose();
                setCurrentQuestionIndex(0);
                setAnswers({});
                setRecommendation(null);
                setQuestions([]);
              }}
              className="text-gray-400 hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className={`p-6 ${recommendation ? 'overflow-y-auto max-h-[calc(100vh-200px)] scrollbar-hide' : ''}`}>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
              </div>
            ) : error ? (
              <div className="text-red-400 text-center py-8">{error}</div>
            ) : !recommendation ? (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-400">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </p>
                </div>

                <h3 className="text-xl font-medium text-gray-100 mb-6">
                  {questions[currentQuestionIndex]?.text}
                </h3>

                <div className="grid grid-cols-1 gap-3">
                  {questions[currentQuestionIndex]?.options.map((option) => (
                    <button
                      key={option}
                      onClick={() => handleAnswer(option)}
                      className="p-4 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-left transition-all duration-300 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-gray-500 rounded-full group-hover:border-emerald-500 transition-colors duration-300" />
                        <span className="text-gray-100">{option}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-emerald-900/30 p-6 rounded-lg">
                  <h3 className="text-xl font-medium text-emerald-400 mb-4">Recommended Product</h3>
                  <div className="flex items-start gap-4">
                    <img
                      src={getImageUrl(recommendation.imageUrl)}
                      alt={recommendation.title}
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                    <div>
                      <h4 className="text-lg font-semibold text-gray-100 mb-2">
                        {recommendation.title.split('(')[0].trim()}
                      </h4>
                      <p className="text-gray-400 mb-2">{recommendation.description}</p>
                      <div className="flex items-center gap-4">
                        <span className={`font-bold text-lg ${
                          recommendation.price.isOnSale ? 'text-emerald-400' : 'text-gray-100'
                        }`}>
                          {recommendation.price.currency} {recommendation.price.amount.toFixed(2)}
                        </span>
                        <span className="px-2 py-1 rounded-full text-xs bg-blue-900/50 text-blue-300">
                          {recommendation.category}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-700/50 p-6 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-100 mb-4">Your Preferences</h3>
                  <div className="space-y-4">
                    {questions.map((question, index) => (
                      <div key={question.id} className="bg-gray-800/50 p-4 rounded-lg">
                        <div className="flex items-start gap-3">
                          <span className="text-emerald-400 font-medium">Q{index + 1}:</span>
                          <div className="flex-1">
                            <p className="text-gray-300 mb-2">{question.text}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-400">Your answer:</span>
                              <span className="px-3 py-1 rounded-full text-sm font-medium bg-emerald-900/50 text-emerald-300">
                                {answers[question.id]}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setShowEmailModal(true)}
                  className="w-full p-4 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Send Personalized Email
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showEmailModal && recommendation && (
        <SendPersonalizedMail
          recommendedProduct={recommendation}
          userPreferences={{
            questions,
            answers
          }}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </div>
  );
} 