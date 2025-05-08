import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SearchResult } from '@/app/sales-ai/types';
import { supabase } from '@/utils/supabaseClient';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
console.log('API Key configured:', !!apiKey);

const genAI = new GoogleGenerativeAI(apiKey || '');

export async function POST(request: Request) {
  try {
    const { query, documentId } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    if (documentId) {
      // Fetch document content from Supabase
      try {
        const { data, error } = await supabase
          .from('sales_ai')
          .select('content')
          .eq('id', documentId)
          .single();

        if (error) {
          console.error('Error fetching document content:', error);
          return NextResponse.json(
            { error: 'Failed to fetch document content.' },
            { status: 500 }
          );
        }

        if (data && data.content) {
          // Search within the document content
          const documentContent = data.content as string;
          const searchTerm = query.toLowerCase();

          // Simple search implementation (you can use a more sophisticated search algorithm)
          const results = documentContent.toLowerCase().includes(searchTerm) ? [
            {
              id: '1',
              title: 'Search Result in Document',
              description: `Found "${query}" in document.`, //this should be a snippet from the content in production code
              category: 'Document Content',
              keyFeatures: [],
              features: [],
              pros: [],
              cons: [],
              whyBuy: 'This result was found within the selected document.',
              price: { amount: 0, currency: 'INR', discount: 0, originalPrice: 0, discountAmount: 0, discountType: 'percentage', isOnSale: false, saleEndsAt: '' },
              rating: 0,
              stockStatus: 'in_stock',
              confidence: 1,
            }
          ] : [];

          return NextResponse.json({ results });
        } else {
          return NextResponse.json(
            { error: 'Document content not found.' },
            { status: 404 }
          );
        }
      } catch (error: any) {
        console.error('Error fetching document content:', error);
        return NextResponse.json(
          { error: 'Failed to fetch document content.' },
          { status: 500 }
        );
      }
    }

    if (!apiKey) {
      console.error('Gemini API key is missing');
      return NextResponse.json(
        { error: 'Gemini API key is not configured. Please check your .env.local file.' },
        { status: 500 }
      );
    }

    // Create a prompt for product search
    const prompt = `You are a product search assistant. Search for products related to: "${query}"
    IMPORTANT: Return ONLY a valid JSON object with no additional text or explanation.
    
    CRITICAL REQUIREMENTS:
    1. Query Understanding:
       - Analyze the query for:
         * Product category (e.g., cars, smartphones, laptops)
         * Price range or budget constraints (including lakh/crore)
         * Specific features or requirements
         * Brand preferences
         * Usage scenarios
       - For Indian price formats:
         * "lakh" = 100,000 INR
         * "crore" = 10,000,000 INR
         * Example: "50lakh" = 5,000,000 INR
    
    2. Product Count:
       - If the query doesn't specify a number (e.g., "show me cars"), return EXACTLY 6 products
       - If the query specifies a number (e.g., "show me 3 cars"), return EXACTLY that number of products
       - If the query includes a price filter (e.g., "under 50lakh"), return ALL products that match the price criteria, up to 6 products
       - Each product must be unique and different from others
    
    The JSON must follow this exact structure:
    {
      "results": [
        {
          "id": "1",
          "title": "Product Name",
          "description": "Product description",
          "category": "Category",
          "keyFeatures": [
            {
              "name": "Standout Feature 1",
              "description": "Detailed description of why this feature is unique and valuable",
              "benefit": "How this feature benefits the user",
              "competitiveAdvantage": "Why this feature makes the product better than competitors"
            }
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
            "currency": "INR",
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
    }
    Requirements:
    1. Price Handling (MANDATORY):
       - Always use INR as the currency
       - For Indian price formats:
         * Convert lakh to INR (1 lakh = 100,000 INR)
         * Convert crore to INR (1 crore = 10,000,000 INR)
         * Example: "50lakh" = 5,000,000 INR
    
    2. Product Selection (MANDATORY):
       - Select products that best match the search criteria
       - For price-filtered searches:
         * Return products within the specified price range
         * Include a mix of budget, mid-range, and premium options
         * Ensure all products are within the price limit
         - For feature-specific searches:
         * Prioritize products with the requested features
         * Highlight how each product meets the requirements
       - For brand-specific searches:
         * Include products from the requested brand
         * Compare with similar products from other brands
    
    3. For pros and cons:
       - Include 6-8 specific advantages in the pros array
       - Include 4-6 realistic limitations in the cons array
       - Make them relevant to the product category and features
       - Pros should cover: performance, value, features, build quality, user experience, durability, innovation, and customer support
       - Cons should cover: limitations, potential issues, areas for improvement, compatibility concerns, maintenance requirements, and cost considerations
    
    4. For whyBuy:
       - Write a compelling, concise explanation
       - Focus on unique value proposition
       - Highlight key benefits
       - Make it persuasive but honest
       - Keep it under 2-3 sentences`;

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

        // Check if the query includes a price filter
        const hasPriceFilter = query.toLowerCase().includes('under') || 
                             query.toLowerCase().includes('below') || 
                             query.toLowerCase().includes('less than') ||
                             query.toLowerCase().includes('lakh') ||
                             query.toLowerCase().includes('crore');

        // For price-filtered queries, allow fewer than 6 products if that's all that match
        if (hasPriceFilter) {
          if (parsedResponse.results.length === 0) {
            throw new Error('No products found matching the price criteria');
          }
          return NextResponse.json(parsedResponse);
        }

        // For regular queries, check if a specific number was requested
        const numberMatch = query.match(/\b(\d+)\b/);
        const requestedCount = numberMatch ? parseInt(numberMatch[1]) : 6;

        // Validate product count for regular queries
        if (parsedResponse.results.length !== requestedCount) {
          console.error(`Invalid product count. Expected ${requestedCount}, got ${parsedResponse.results.length}`);
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
        { error: 'Failed to generate search results. Please check your API key and try again.' },
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