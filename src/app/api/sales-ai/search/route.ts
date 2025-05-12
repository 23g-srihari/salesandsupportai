import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SearchResult } from '@/app/sales-ai/types';
import { supabase } from '@/utils/supabaseClient';

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
// console.log('API Key configured:', !!apiKey);

const genAI = new GoogleGenerativeAI(apiKey || '');
const GEMINI_EMBEDDING_MODEL_ID_FOR_QUERY = "text-embedding-004"; // Or your chosen model
const GOOGLE_API_BASE_URL_FOR_EMBEDDING = "https://generativelanguage.googleapis.com/v1beta/models"; // Ensure this is correct

async function getQueryEmbedding(queryText: string): Promise<number[] | null> {
  if (!apiKey) {
    // console.error("getQueryEmbedding: GEMINI_API_KEY is not configured.");
    return null;
  }
  if (!queryText || queryText.trim() === "") {
    // console.log("getQueryEmbedding: Query text is empty. Skipping embedding call.");
    return null;
  }

  const trimmedText = queryText.substring(0, 8000); // Respect model limits
  // console.log(`getQueryEmbedding: Calling Gemini (${GEMINI_EMBEDDING_MODEL_ID_FOR_QUERY}) for query: "${trimmedText.substring(0,50)}..."`);
  const requestUrl = `${GOOGLE_API_BASE_URL_FOR_EMBEDDING}/${GEMINI_EMBEDDING_MODEL_ID_FOR_QUERY}:embedContent?key=${apiKey}`;
  
  try {
    const response = await fetch(requestUrl, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: `models/${GEMINI_EMBEDDING_MODEL_ID_FOR_QUERY}`, content: { parts: [{ text: trimmedText }] } }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        // console.error("getQueryEmbedding: Gemini API error (Embedding):", response.status, errorBody);
        // Consider not throwing here but returning null so the main flow can decide how to handle it.
        return null; 
    }
    const result = await response.json();
    if (result.embedding?.values && Array.isArray(result.embedding.values)) {
        // console.log(`getQueryEmbedding: Embedding received. Vector dimension: ${result.embedding.values.length}`);
        return result.embedding.values;
    }
    // console.error("getQueryEmbedding: Unexpected Gemini embedding response structure. Full response:", JSON.stringify(result));
    return null;
  } catch (error) {
    const e = error instanceof Error ? error : new Error(String(error));
    // console.error("getQueryEmbedding: Exception during embedding API call:", e.message);
    return null;
  }
}

interface ParsedDocQuery {
  keywords: string[];
  minPrice?: number;
  maxPrice?: number;
  category?: string;
}

function parseDocumentQuery(query: string): ParsedDocQuery {
  const lowerQuery = query.toLowerCase();
  let keywords: string[] = [];
  let minPrice: number | undefined;
  let maxPrice: number | undefined;
  let category: string | undefined;

  interface UnitMultipliers { [key: string]: number; }

  // Price parsing (lakh, crore, under, above, between)
  const pricePatterns: { regex: RegExp; type: string; unitMultiplier: UnitMultipliers }[] = [
    { regex: /under\s*(\d*\.?\d+)\s*(lakh|l|crore|cr|k)/i, type: 'max', unitMultiplier: { l: 100000, lakh: 100000, cr: 10000000, crore: 10000000, k: 1000 } },
    { regex: /under\s*(\d+\.?\d*)/i, type: 'max', unitMultiplier: {} },
    { regex: /below\s*(\d*\.?\d+)\s*(lakh|l|crore|cr|k)/i, type: 'max', unitMultiplier: { l: 100000, lakh: 100000, cr: 10000000, crore: 10000000, k: 1000 } },
    { regex: /below\s*(\d+\.?\d*)/i, type: 'max', unitMultiplier: {} },
    { regex: /less\s*than\s*(\d*\.?\d+)\s*(lakh|l|crore|cr|k)/i, type: 'max', unitMultiplier: { l: 100000, lakh: 100000, cr: 10000000, crore: 10000000, k: 1000 } },
    { regex: /less\s*than\s*(\d+\.?\d*)/i, type: 'max', unitMultiplier: {} },
    { regex: /max\s*price\s*(\d*\.?\d+)\s*(lakh|l|crore|cr|k)/i, type: 'max', unitMultiplier: { l: 100000, lakh: 100000, cr: 10000000, crore: 10000000, k: 1000 } },
    { regex: /max\s*price\s*(\d+\.?\d*)/i, type: 'max', unitMultiplier: {} },

    { regex: /above\s*(\d*\.?\d+)\s*(lakh|l|crore|cr|k)/i, type: 'min', unitMultiplier: { l: 100000, lakh: 100000, cr: 10000000, crore: 10000000, k: 1000 } },
    { regex: /above\s*(\d+\.?\d*)/i, type: 'min', unitMultiplier: {} },
    { regex: /over\s*(\d*\.?\d+)\s*(lakh|l|crore|cr|k)/i, type: 'min', unitMultiplier: { l: 100000, lakh: 100000, cr: 10000000, crore: 10000000, k: 1000 } },
    { regex: /over\s*(\d+\.?\d*)/i, type: 'min', unitMultiplier: {} },
    { regex: /min\s*price\s*(\d*\.?\d+)\s*(lakh|l|crore|cr|k)/i, type: 'min', unitMultiplier: { l: 100000, lakh: 100000, cr: 10000000, crore: 10000000, k: 1000 } },
    { regex: /min\s*price\s*(\d+\.?\d*)/i, type: 'min', unitMultiplier: {} },

    { regex: /between\s*(\d*\.?\d+)\s*(lakh|l|crore|cr|k)?\s*and\s*(\d*\.?\d+)\s*(lakh|l|crore|cr|k)?/i, type: 'between', unitMultiplier: { l: 100000, lakh: 100000, cr: 10000000, crore: 10000000, k: 1000 } },
    { regex: /between\s*(\d+\.?\d*)\s*and\s*(\d+\.?\d*)/i, type: 'between', unitMultiplier: {} }, 
  ];

  let queryWithoutPrices = lowerQuery;

  for (const p of pricePatterns) {
    const match = queryWithoutPrices.match(p.regex);
    if (match) {
      if (p.type === 'between') {
        const val1 = parseFloat(match[1]);
        const unit1 = match[2]?.toLowerCase();
        const val2 = parseFloat(match[3]);
        const unit2 = match[4]?.toLowerCase();
        const multiplier1 = unit1 ? p.unitMultiplier[unit1] || 1 : 1;
        const multiplier2 = unit2 ? p.unitMultiplier[unit2] || 1 : 1;
        minPrice = val1 * multiplier1;
        maxPrice = val2 * multiplier2;
      } else {
        const val = parseFloat(match[1]);
        const unit = match[2]?.toLowerCase();
        const multiplier = unit ? p.unitMultiplier[unit] || 1 : 1;
        if (p.type === 'max') maxPrice = val * multiplier;
        if (p.type === 'min') minPrice = val * multiplier;
      }
      queryWithoutPrices = queryWithoutPrices.replace(p.regex, '').trim(); // Remove matched part
      break; // Process first price pattern match
    }
  }

  // Simple category extraction (can be improved, e.g. with a predefined list)
  const knownCategories = ["smartphones", "mobiles", "phones", "laptops", "computers", "headphones", "earphones", "televisions", "tv"];
  for (const cat of knownCategories) {
    if (queryWithoutPrices.includes(cat)) {
      category = cat;
      // Normalize category if needed, e.g., "phones" -> "smartphones"
      if (["mobiles", "phones"].includes(cat)) category = "smartphones";
      if (["tv"].includes(cat)) category = "televisions";
      if (["earphones"].includes(cat)) category = "headphones";
      queryWithoutPrices = queryWithoutPrices.replace(new RegExp(cat, 'gi'), '').trim();
      break; // Take first category found
    }
  }

  const stopWords = ['best', 'top', 'show', 'me', 'find', 'search', 'for', 'what', 'are', 'is', 'display', 'get', 'tell', 'give', 'a', 'an', 'the', 'of', 'in', 'on', 'at', 'with', 'about', 'under', 'above', 'from'];
  keywords = queryWithoutPrices.split(' ')
    .filter(kw => kw.length > 1 && !stopWords.includes(kw.toLowerCase()));

  if (category && !keywords.includes(category) && category !== "smartphones" && category !== "televisions" && category !== "headphones" ) {
      // Add category to keywords if it's specific and not already a broad part of the remaining query
      // This avoids adding "smartphones" if remaining keywords are e.g. "iphone"
  } else if (category && keywords.length === 0) {
      // If query was ONLY a category like "smartphones", add it as a keyword for text search too
      keywords.push(category);
  }


  // console.log("Parsed Query:", { keywords, minPrice, maxPrice, category });
  return { keywords, minPrice, maxPrice, category };
}

export async function POST(request: Request) {
  try {
    // Add requestedMatchCount to the destructuring, provide a default if not present
    const { query, documentId, requestedMatchCount } = await request.json(); 

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    if (documentId) {
      // console.log(`Vector search within document ID: ${documentId} for query: "${query}"`);
      try {
        const queryEmbedding = await getQueryEmbedding(query);
        const parsedQuery = parseDocumentQuery(query); // Call parser to get category and other info

        if (!queryEmbedding) {
          // console.error('Failed to generate query embedding. Cannot perform vector search.');
          // Fallback to text-based filtering if embedding fails, now using the parsedQuery from above.
          // console.log('Falling back to text-based filtering due to embedding failure.');
          // const parsedQuery = parseDocumentQuery(query); // Already called above
          let queryBuilder = supabase
            .from('analyzed_products')
            .select('*')
            .eq('uploaded_file_id', documentId);
          if (parsedQuery.category) {
            queryBuilder = queryBuilder.ilike('product_type', `%${parsedQuery.category}%`);
          }
          if (parsedQuery.keywords.length > 0) {
            const orConditions = parsedQuery.keywords
              .map(kw => `product_name.ilike.%${kw}%,analysis_summary.ilike.%${kw}%,product_type.ilike.%${kw}%`)
              .join(',');
            queryBuilder = queryBuilder.or(orConditions);
          }
          const { data: fallbackProducts, error: fallbackError } = await queryBuilder;
          if (fallbackError) throw fallbackError; // Let the main catch handle it
          if (!fallbackProducts) return NextResponse.json({ results: [] });
          // Proceed with mapping logic for fallbackProducts - THIS MAPPING NEEDS TO BE THE CORRECTED ONE
           const results: SearchResult[] = fallbackProducts.map((product: any) => {
            let priceAmount = 0;
            let originalPrice = 0;
            let discountAmount = 0;
            let discountPercentage = 0;
            let isOnSale = false;
            let currency = 'INR'; // Default currency

            if (product.price && typeof product.price === 'string') {
                // Basic parsing for string prices like "1000", "1,000", "₹1000", "1000 INR"
                // This won't handle "lakh" or complex currency formats without more logic
                const priceMatch = product.price.match(/[\d,.]+/);
                if (priceMatch && priceMatch[0]) {
                    priceAmount = parseFloat(priceMatch[0].replace(/,/g, '')) || 0;
                    originalPrice = priceAmount; // Assume original is same unless discounted_price says otherwise
                }
                // Very basic currency extraction (you might have a dedicated currency field)
                if (product.price.includes('$') || product.price.toLowerCase().includes('usd')) currency = 'USD';
                // Add other currency detections if needed
            }

            if (product.discounted_price && typeof product.discounted_price === 'string') {
                const discountedPriceMatch = product.discounted_price.match(/[\d,.]+/);
                if (discountedPriceMatch && discountedPriceMatch[0]) {
                    const discountedNum = parseFloat(discountedPriceMatch[0].replace(/,/g, '')) || 0;
                    if (discountedNum < priceAmount) {
                        originalPrice = priceAmount; // The product.price was original
                        priceAmount = discountedNum;  // This is now the effective amount
                        isOnSale = true;
                        discountAmount = originalPrice - priceAmount;
                        if (originalPrice > 0) {
                            discountPercentage = Math.round((discountAmount / originalPrice) * 100);
                        }
                    } else {
                         // If discounted price is not less, or product.price was 0, treat discounted_price as the main price if valid
                        if (priceAmount === 0 && discountedNum > 0) priceAmount = discountedNum;
                        // originalPrice remains as product.price or the newly set priceAmount
                        if (originalPrice === 0) originalPrice = priceAmount; 
                    }
                }
            }
             if (originalPrice === 0) originalPrice = priceAmount; // Ensure original price is at least the sale price


            return {
                id: product.id.toString(),
                title: product.product_name || 'N/A',
                description: product.analysis_summary || 'No summary available.',
                category: product.product_type || 'General',
                keyFeatures: [], 
                features: product.features && (Array.isArray(product.features) || typeof product.features === 'object') 
                            ? Object.values(product.features).map((f: any) => ({ name: typeof f === 'string' ? f : JSON.stringify(f), description: '', benefit: '' })) 
                            : [], // Handle JSONB arrays/objects for features
                pros: product.pros && (Array.isArray(product.pros) || typeof product.pros === 'object') 
                            ? Object.values(product.pros).map((p: any) => typeof p === 'string' ? p : JSON.stringify(p)) 
                            : [], // Handle JSONB arrays/objects for pros
                cons: product.cons && (Array.isArray(product.cons) || typeof product.cons === 'object') 
                            ? Object.values(product.cons).map((c: any) => typeof c === 'string' ? c : JSON.stringify(c)) 
                            : [], // Handle JSONB arrays/objects for cons
                whyBuy: product.why_should_i_buy || 'Information not available.',
                price: {
                    amount: priceAmount,
                    currency: currency,
                    discount: discountPercentage,
                    originalPrice: originalPrice,
                    discountAmount: discountAmount,
                    discountType: 'percentage',
                    isOnSale: isOnSale,
                    saleEndsAt: '', 
                },
                rating: product.rating || 0, 
                stockStatus: 'in_stock', 
                confidence: product.similarity || 0.7, // Use similarity from RPC or default for fallback
            };
        });
        return NextResponse.json({ results });
        }

        // Proceed with RPC call if embedding was generated
        const rpcParams: { [key: string]: any } = { // Define rpcParams with index signature
          query_embedding: `[${queryEmbedding.join(',')}]`, // Format as string for pgvector
          match_document_id: documentId,
          match_threshold: 0.3, // Keep lower for hybrid, or adjust as needed
          match_count: (typeof requestedMatchCount === 'number' && requestedMatchCount > 0) ? Math.min(requestedMatchCount, 50) : 6, // Use user's count, default 6, max 50
        };

        if (parsedQuery.category) {
          rpcParams.filter_product_type = parsedQuery.category;
        }
        // TODO: If parseDocumentQuery also reliably extracts minPrice/maxPrice from the query,
        // and your SQL function is updated to handle them, you could pass them here too.

        // console.log("Calling RPC 'match_products_in_document' with params:", {
        //     match_document_id: rpcParams.match_document_id,
        //     match_threshold: rpcParams.match_threshold,
        //     match_count: rpcParams.match_count,
        //     filter_product_type: rpcParams.filter_product_type, // Log new param
        //     query_embedding_snippet: rpcParams.query_embedding.substring(0,50) + "..."
        // });

        const { data: rpcData, error: rpcError } = await supabase.rpc(
          'match_products_in_document',
          rpcParams
        );

        if (rpcError) {
          // console.error('Error calling RPC match_products_in_document:', rpcError);
          return NextResponse.json(
            { error: `Failed to search products in document: ${rpcError.message}` },
            { status: 500 }
          );
        }

        if (!rpcData) {
          // console.log('No products returned from RPC for document search.');
          return NextResponse.json({ results: [] });
        }

        // console.log(`RPC returned ${rpcData.length} products.`);

        // Map RPC results (which should match analyzed_products structure + similarity) to SearchResult structure
        const results: SearchResult[] = rpcData.map((product: any) => {
            let priceAmount = 0;
            let originalPrice = 0;
            let discountAmount = 0;
            let discountPercentage = 0;
            let isOnSale = false;
            let currency = 'INR'; // Default currency

            // Price parsing for string fields from SQL function
            if (product.price && typeof product.price === 'string') {
                const priceMatch = product.price.match(/[\d,.]+/);
                if (priceMatch && priceMatch[0]) {
                    priceAmount = parseFloat(priceMatch[0].replace(/,/g, '')) || 0;
                    originalPrice = priceAmount;
                }
                if (product.price.includes('$') || product.price.toLowerCase().includes('usd')) currency = 'USD';
            }

            if (product.discounted_price && typeof product.discounted_price === 'string') {
                const discountedPriceMatch = product.discounted_price.match(/[\d,.]+/);
                if (discountedPriceMatch && discountedPriceMatch[0]) {
                    const discountedNum = parseFloat(discountedPriceMatch[0].replace(/,/g, '')) || 0;
                    if (discountedNum > 0 && discountedNum < priceAmount) {
                        originalPrice = priceAmount;
                        priceAmount = discountedNum;
                        isOnSale = true;
                        discountAmount = originalPrice - priceAmount;
                        if (originalPrice > 0) {
                            discountPercentage = Math.round((discountAmount / originalPrice) * 100);
                        }
                    } else if (priceAmount === 0 && discountedNum > 0) {
                        priceAmount = discountedNum; // Use discounted if main price was 0 or invalid
                        originalPrice = discountedNum;
                    }
                }
            }
            if (originalPrice === 0 && priceAmount > 0) originalPrice = priceAmount;

            // Handling JSONB for features, pros, cons if your SQL function returns them as JSONB
            // The SQL function was defined to return TEXT[] or JSONB based on your table schema.
            // If they are JSONB and represent arrays of strings:
            const mapJsonbArray = (jsonbField: any): string[] => {
                if (!jsonbField) return [];
                if (Array.isArray(jsonbField)) return jsonbField.map(item => String(item));
                // If it's an object that needs specific parsing, adjust here
                return []; 
            };
            const mapJsonbFeatures = (jsonbField: any): { name: string; description: string; benefit: string }[] => {
                 if (!jsonbField) return [];
                 if (Array.isArray(jsonbField)) return jsonbField.map(item => ({ name: String(item), description: '', benefit: '' }));
                 return [];
            };


            return {
                id: product.id.toString(),
                title: product.product_name || 'N/A',
                description: product.analysis_summary || 'No summary available.',
                category: product.product_type || 'General',
                keyFeatures: [], // Populate if you have specific logic for this from RPC results
                features: mapJsonbFeatures(product.features),
                pros: mapJsonbArray(product.pros),
                cons: mapJsonbArray(product.cons),
                whyBuy: product.why_should_i_buy || 'Information not available.',
                price: {
                    amount: priceAmount,
                    currency: currency,
                    discount: discountPercentage,
                    originalPrice: originalPrice,
                    discountAmount: discountAmount,
                    discountType: 'percentage',
                    isOnSale: isOnSale,
                    saleEndsAt: '', // Not available from SQL function result
                },
                rating: product.rating || 0, // Assuming rating might be part of analyzed_products or added to SQL func
                stockStatus: 'in_stock', // Default
                confidence: product.similarity || 0, // Use similarity from RPC!
            };
        });

        return NextResponse.json({ results });

      } catch (error: any) {
        // console.error('Error processing search within document:', error);
        return NextResponse.json(
          { error: 'Failed to process search within the document.' },
          { status: 500 }
        );
      }
    }

    if (!apiKey) {
      // console.error('Gemini API key is missing');
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
      // console.log('Initializing Gemini model...');
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      // console.log('Generating content...');
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // console.log('Raw API Response:', text);

      if (!text) {
        // console.error('Empty response from Gemini API');
        throw new Error('No response from Gemini API');
      }

      try {
        // Try to find JSON in the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          // console.error('No JSON found in response:', text);
          throw new Error('No valid JSON found in response');
        }

        const jsonStr = jsonMatch[0];
        // console.log('Extracted JSON string:', jsonStr);

        // Parse the response
        const parsedResponse = JSON.parse(jsonStr);
        // console.log('Parsed Response:', parsedResponse);

        // Validate the response structure
        if (!parsedResponse.results || !Array.isArray(parsedResponse.results)) {
          // console.error('Invalid response structure:', parsedResponse);
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
          // For price-filtered queries, the Gemini prompt aims to return all matches up to 6.
          // We don't further trim here unless a specific requestedMatchCount from client is lower.
          let finalResultsForPriceFilter = parsedResponse.results;
          if (typeof requestedMatchCount === 'number' && requestedMatchCount > 0 && finalResultsForPriceFilter.length > requestedMatchCount) {
            // console.log(`Price filter query: Trimming Gemini results from ${finalResultsForPriceFilter.length} to client requested ${requestedMatchCount}`);
            finalResultsForPriceFilter = finalResultsForPriceFilter.slice(0, requestedMatchCount);
          }
          if (finalResultsForPriceFilter.length === 0) {
             throw new Error('No products found matching the price criteria');
          }
          return NextResponse.json({ results: finalResultsForPriceFilter });
        }

        // Determine the desired number of results for non-price-filter global queries
        let finalDesiredCount = 6; // Default for generic queries as per Gemini prompt
        const numberInQueryMatch = query.match(/\b(\d+)\b/);
        const countFromQuery = numberInQueryMatch ? parseInt(numberInQueryMatch[1]) : null;

        if (typeof requestedMatchCount === 'number' && requestedMatchCount > 0) {
          finalDesiredCount = Math.min(requestedMatchCount, 50); // Use client's request, capped
        } else if (countFromQuery && countFromQuery > 0) {
          finalDesiredCount = countFromQuery; // Use count from query string if client didn't specify
        }
        // The Gemini prompt is also instructed to return a specific number if mentioned in the query,
        // or 6 by default for generic queries.
        // This logic primarily ensures client's requestedMatchCount is respected if provided,
        // or trims if Gemini over-delivers based on query's number.

        let finalResults = parsedResponse.results;

        // Adherence to prompt for count:
        // The prompt asks Gemini for specific counts. If Gemini doesn't adhere, we log it.
        // If client specified requestedMatchCount, we prioritize that for the final trim.
        const expectedByPrompt = countFromQuery || 6; // What the prompt asked Gemini to aim for.
        if (finalResults.length !== expectedByPrompt && !(typeof requestedMatchCount === 'number' && requestedMatchCount > 0) ) {
            // console.warn(`Gemini product count mismatch for global search. Prompt expected ${expectedByPrompt}, Gemini returned ${finalResults.length}.`);
        }

        if (finalResults.length > finalDesiredCount) {
          // console.log(`Global search: Trimming Gemini results from ${finalResults.length} to ${finalDesiredCount}`);
          finalResults = finalResults.slice(0, finalDesiredCount);
        } else if (finalResults.length < finalDesiredCount && (typeof requestedMatchCount === 'number' && requestedMatchCount > 0)){
          // If client requested more than Gemini returned (and Gemini didn't hit its own cap based on prompt)
          // there isn't much to do other than return what Gemini gave.
          // We could log this, but for now, we just return the fewer items.
          // console.log(`Global search: Gemini returned ${finalResults.length}, client/query desired ${finalDesiredCount}. Returning available results.`);
        }

        if (finalResults.length === 0 && query) { // Avoid error if original query was valid but yielded no results
             // console.log("Global search: No products found after Gemini processing and filtering.");
             //  throw new Error('No products found matching your query.'); // Or just return empty
        }

        return NextResponse.json({ results: finalResults });
      } catch (parseError) {
        // console.error('Failed to parse API response:', text);
        // console.error('Parse error details:', parseError);
        throw new Error('Failed to parse API response. Please try again.');
      }
    } catch (apiError) {
      // console.error('Gemini API error:', apiError);
      return NextResponse.json(
        { error: 'Failed to generate search results. Please check your API key and try again.' },
        { status: 500 }
      );
    }
  } catch (error) {
    // console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to process search request. Please try again.' },
      { status: 500 }
    );
  }
}