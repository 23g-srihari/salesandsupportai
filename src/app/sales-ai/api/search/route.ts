import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SearchResult } from '@/app/sales-ai/types';
import { useSession, signIn, signOut } from 'next-auth/react';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
console.log('API Key configured:', !!apiKey);

const genAI = new GoogleGenerativeAI(apiKey || '');

export async function POST(request: Request) {
  try {
    const { query, filters } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      console.error('Gemini API key is missing');
      return NextResponse.json(
        { error: 'Gemini API key is not configured. Please check your .env.local file.' },
        { status: 500 }
      );
    }

    // Check if query specifies a number
    const numberMatch = query.match(/\b(\d+)\b/);
    const requestedCount = numberMatch ? parseInt(numberMatch[1]) : 6;

    // Create a prompt for product search with filters
    const prompt = `You are a product search assistant. Search for products related to: "${query}"
    ${filters ? `Apply the following filters:
    - Price Range: $${filters.priceRange[0]} - $${filters.priceRange[1]}
    - Sort By: ${filters.sortBy}
    - Sort Order: ${filters.sortOrder}
    ` : ''}
    
    IMPORTANT: Return ONLY a valid JSON object with no additional text or explanation.
    
    CRITICAL REQUIREMENTS:
    1. Product Count:
       - You MUST return EXACTLY ${requestedCount} products
       - Each product must be unique and different from others
    
    The JSON must follow this exact structure:
    {
      "results": [
        {
          "id": "1",
          "title": "Product Name",
          "description": "Product description",
          "category": "Category",
          "imageUrl": "https://example.com/product-image.jpg",
          "keyFeatures": [
            "Standout feature 1 that makes this product unique",
            "Standout feature 2 that differentiates from competitors",
            "Standout feature 3 that provides exceptional value",
            "Standout feature 4 that addresses specific user needs"
          ],
          "features": [
            {
              "name": "Feature 1",
              "description": "Description of feature 1",
              "benefit": "Benefit of feature 1"
            }
          ],
          "pros": [
            "Advantage 1",
            "Advantage 2",
            "Advantage 3",
            "Advantage 4",
            "Advantage 5",
            "Advantage 6",
            "Advantage 7",
            "Advantage 8"
          ],
          "cons": [
            "Limitation 1",
            "Limitation 2",
            "Limitation 3",
            "Limitation 4",
            "Limitation 5",
            "Limitation 6"
          ],
          "whyBuy": "A compelling reason why customers should buy this product, highlighting its unique value proposition and key benefits.",
          "price": {
            "amount": 999.99,
            "currency": "USD",
            "discount": 15,
            "originalPrice": 1176.46,
            "discountAmount": 176.47,
            "discountType": "percentage",
            "isOnSale": true,
            "saleEndsAt": "2024-03-31"
          },
          "rating": 4.5,
          "stockStatus": "in_stock",
          "confidence": 0.95
        }
      ]
    }`;

    try {
      console.log('Initializing Gemini model...');
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      console.log('Generating content...');
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log('Raw API Response:', text);

      if (!text) {
        console.error('Empty response from Gemini API');
        throw new Error('No response from Gemini API');
      }

      try {
        // Try to find JSON in the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error('No JSON found in response:', text);
          throw new Error('No valid JSON found in response');
        }

        const jsonStr = jsonMatch[0];
        console.log('Extracted JSON string:', jsonStr);

        // Parse the response
        const parsedResponse = JSON.parse(jsonStr);
        console.log('Parsed Response:', parsedResponse);

        // Validate the response structure
        if (!parsedResponse.results || !Array.isArray(parsedResponse.results)) {
          console.error('Invalid response structure:', parsedResponse);
          throw new Error('Invalid response structure from API');
        }

        // Validate exact product count
        if (parsedResponse.results.length !== requestedCount) {
          console.error(`Invalid product count. Expected ${requestedCount} products, got ${parsedResponse.results.length}`);
          throw new Error(`Invalid product count. Expected ${requestedCount} products.`);
        }

        return NextResponse.json(parsedResponse);
      } catch (parseError) {
        console.error('Failed to parse API response:', text);
        console.error('Parse error details:', parseError);
        throw new Error('Failed to parse API response. Please try again.');
      }
    } catch (apiError) {
      console.error('Gemini API error:', apiError);
      return NextResponse.json(
        { error: 'Failed to generate search results. Please try again.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to process search request. Please try again.' },
      { status: 500 }
    );
  }
}

