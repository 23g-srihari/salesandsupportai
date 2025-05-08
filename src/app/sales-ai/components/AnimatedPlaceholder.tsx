'use client';

import { useState, useEffect } from 'react';

const exampleSearches = [
  'Find the best laptops under $1000',
  'Show me wireless headphones with noise cancellation',
  'Search for gaming monitors with 144Hz refresh rate',
  'Find smartphones with great camera quality',
  'Show me the latest smartwatches'
];

export default function AnimatedPlaceholder() {
  const [currentText, setCurrentText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    const currentSearch = exampleSearches[currentIndex];
    
    if (isTyping) {
      if (currentText.length < currentSearch.length) {
        const timeout = setTimeout(() => {
          setCurrentText(currentSearch.slice(0, currentText.length + 1));
        }, 50);
        return () => clearTimeout(timeout);
      } else {
        const timeout = setTimeout(() => {
          setIsTyping(false);
        }, 2000);
        return () => clearTimeout(timeout);
      }
    } else {
      if (currentText.length > 0) {
        const timeout = setTimeout(() => {
          setCurrentText(currentText.slice(0, -1));
        }, 30);
        return () => clearTimeout(timeout);
      } else {
        const timeout = setTimeout(() => {
          setIsTyping(true);
          setCurrentIndex((currentIndex + 1) % exampleSearches.length);
        }, 500);
        return () => clearTimeout(timeout);
      }
    }
  }, [currentText, currentIndex, isTyping]);

  return (
    <span className="text-gray-400 dark:text-gray-500">
      {currentText}
      <span className="animate-pulse">|</span>
    </span>
  );
} 