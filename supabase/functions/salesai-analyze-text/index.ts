// supabase/functions/salesai-analyze-text/index.ts
import { serve, ConnInfo } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- IMPORTANT: Update this version marker when you deploy ---
console.log('SalesAI Analyze Text (Gemini) Edge Function initializing (v1.2 - Tuned Embedding Text)...');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RequestBody {
  recordId: string | number; // This is the ID from 'uploaded_files' table
  extractedText: string;
}

function createJsonResponse(body: Record<string, any> | string, status: number, currentCorsHeaders: Record<string, string>): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    headers: { ...currentCorsHeaders, 'Content-Type': 'application/json' },
    status: status,
  });
}

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
// TODO: Confirm your exact model IDs from Google AI Studio or Gemini documentation
const GEMINI_LIST_PRODUCTS_MODEL_ID = "gemini-2.0-flash"; // Model to identify product names
const GEMINI_ANALYSIS_MODEL_ID = "gemini-2.0-flash";      // Model for detailed analysis of one product
const GEMINI_EMBEDDING_MODEL_ID = "text-embedding-004"; // Assumes 768 dimensions
const GOOGLE_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

async function callGeminiToIdentifyProducts(text: string): Promise<string[] | null> {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");
    if (!text || text.trim() === "") {
        console.log("Text for product identification is empty, returning empty array.");
        return [];
    }

    const prompt = `
    From the following text, identify all distinct product names or clear product mentions.
    Return a valid JSON array of strings, where each string is a product name.
    If no distinct products are found, return an empty array [].
    Do not add any explanatory text before or after the JSON array.

    Text:
    ---
    ${text.substring(0, 15000)} 
    ---
    JSON Array Output:`;

    console.log(`Calling Gemini (${GEMINI_LIST_PRODUCTS_MODEL_ID}) to identify products. Text length: ${text.length}`);
    const requestUrl = `${GOOGLE_API_BASE_URL}/${GEMINI_LIST_PRODUCTS_MODEL_ID}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1024 } 
        }),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Gemini API error (Product Identification):", response.status, errorBody);
        throw new Error(`Gemini product identification API request failed (${response.status}): ${errorBody}`);
    }
    const result = await response.json();
    if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
        const jsonString = result.candidates[0].content.parts[0].text;
        console.log("Gemini product identification raw JSON string:", jsonString);
        try {
            const cleaned = jsonString.replace(/^```json\s*|\s*```$/g, '').trim();
            const productNames = JSON.parse(cleaned);
            if (Array.isArray(productNames) && productNames.every(item => typeof item === 'string')) {
                console.log("Successfully parsed product names from Gemini:", productNames);
                return productNames;
            } else {
                console.error("Gemini product identification response was not a valid array of strings:", cleaned);
                return []; 
            }
        } catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            console.error("Failed to parse JSON for product names:", error.message, "Raw:", jsonString);
            return [];
        }
    }
    console.error("Unexpected Gemini product identification response structure:", result);
    throw new Error("Unexpected Gemini product identification response.");
}

async function callGeminiForSingleProductAnalysis(productName: string, fullContextText: string): Promise<any | null> {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set for single product analysis.");
    
    const prompt = `
    Analyze *only* the product named "${productName}" based on the provided "Full Context Text".
    Provide the output as a single, valid JSON object.
    Keys:
      "product_name": (string, should be similar to or exactly "${productName}"),
      "product_type": (string, e.g., "Smartphone", "Laptop", "Headphones". Be as specific as possible based on the text),
      "price": (string, e.g., "$99.00", "₹1.2 Lakh", "120,000 INR". Include currency symbol or code if available. If not found, use null),
      "discounted_price": (string|null, e.g., "$79.00", "₹1 Lakh". If no discount or not found, use null),
      "features": (array of strings, list key features),
      "pros": (array of strings, list at least 3 pros),
      "cons": (array of strings, list at least 2 cons),
      "why_should_i_buy": (string, a compelling reason),
      "analysis_summary": (string, a brief summary of *this* product),
      "source_text_snippet": (string, a short, relevant quote from the "Full Context Text" that provides evidence for the product details or mentions the product. Max 150 characters. If no direct snippet, provide a brief justification for identifying the product from the text.).

    If information for a key is not found for "${productName}", use null for strings/numbers or an empty array [] for arrays.
    Do not add any explanatory text before or after the JSON object.

    Full Context Text:
    ---
    ${fullContextText.substring(0, 15000)} 
    ---
    JSON Output for product "${productName}":`;

    console.log(`Calling Gemini (${GEMINI_ANALYSIS_MODEL_ID}) for analysis of "${productName}" (prompt expects string prices and product_type, includes snippet).`);
    const requestUrl = `${GOOGLE_API_BASE_URL}/${GEMINI_ANALYSIS_MODEL_ID}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(requestUrl, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 2048 } // Adjust temperature for factuality
        }),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Gemini API error (Single Product Analysis for ${productName}):`, response.status, errorBody);
        throw new Error(`Gemini single product analysis API request failed (${response.status}): ${errorBody}`);
    }
    const result = await response.json();
    if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
        const jsonString = result.candidates[0].content.parts[0].text;
        console.log(`Gemini single product analysis raw JSON for "${productName}":`, jsonString);
        try {
            const cleaned = jsonString.replace(/^```json\s*|\s*```$/g, '').trim();
            const parsedJson = JSON.parse(cleaned);
            console.log(`Successfully parsed JSON for "${productName}".`);
            return parsedJson;
        } catch (e) {
            const error = e instanceof Error ? e : new Error(String(e));
            console.error(`Failed to parse JSON for single product analysis of "${productName}":`, error.message, "Raw:", jsonString);
            throw new Error(`Failed to parse JSON for ${productName}: ${error.message}. Raw: ${jsonString.substring(0,100)}`);
        }
    }
    console.error(`Unexpected Gemini single product analysis response structure for ${productName}:`, result);
    throw new Error(`Unexpected Gemini analysis response for ${productName}.`);
}

async function callGeminiForEmbedding(textToEmbed: string): Promise<number[] | null> {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY for embedding not set.");
    if (!textToEmbed || textToEmbed.trim() === "") {
        console.log("Text for embedding is empty. Skipping embedding call.");
        return null;
    }
    const trimmedText = textToEmbed.substring(0, 8000); // Respect model limits

    console.log(`Calling Gemini (${GEMINI_EMBEDDING_MODEL_ID}) for embedding. Text length: ${trimmedText.length}`);
    const requestUrl = `${GOOGLE_API_BASE_URL}/${GEMINI_EMBEDDING_MODEL_ID}:embedContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(requestUrl, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: `models/${GEMINI_EMBEDDING_MODEL_ID}`, content: { parts: [{ text: trimmedText }] } }),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Gemini API error (Embedding):", response.status, errorBody);
        throw new Error(`Gemini embedding API request failed (${response.status}): ${errorBody}`);
    }
    const result = await response.json();
    if (result.embedding?.values && Array.isArray(result.embedding.values)) {
        console.log(`Embedding received. Vector dimension: ${result.embedding.values.length}`);
        return result.embedding.values;
    }
    console.error("Unexpected Gemini embedding response structure. Full response:", JSON.stringify(result));
    throw new Error("Unexpected Gemini embedding response or missing values.");
}

serve(async (req: Request, _connInfo: ConnInfo): Promise<Response> => {
  const functionName = 'salesai-analyze-text';
  let supabaseAdminClient: SupabaseClient; 
  let requestPayload : RequestBody; 

  try {
    const supabaseUrlEnv = Deno.env.get('SUPABASE_URL');
    const serviceKeyEnv = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrlEnv || !serviceKeyEnv || !GEMINI_API_KEY) {
         console.error(`Missing env vars in ${functionName}.`);
         return createJsonResponse({ error: 'Server configuration error.' }, 500, corsHeaders);
    }
    supabaseAdminClient = createClient(supabaseUrlEnv, serviceKeyEnv, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }});
    
    if (!req.body) {
        console.error(`Request body is null for ${functionName}.`);
        return createJsonResponse({ error: 'Request body missing' }, 400, corsHeaders);
    }
    try { 
        requestPayload = await req.json(); 
    } catch (e) { 
        const error = e instanceof Error ? e : new Error(String(e));
        console.error(`Invalid JSON in request body for ${functionName}: ${error.message}`);
        return createJsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders); 
    }
    
    const { recordId: uploadedFileId, extractedText } = requestPayload; 
    console.log(`Analyzing text for uploaded_files.id: ${uploadedFileId}. Extracted text length: ${extractedText?.length || 0}`);

    if (!uploadedFileId || typeof extractedText !== 'string' ) { // Allow empty extractedText initially
        await supabaseAdminClient.from('uploaded_files').update({ status: 'analysis_failed', error_message: 'Missing recordId or extractedText for analysis.' }).eq('id', uploadedFileId || 'unknown'); // Fallback for unknown ID
        return createJsonResponse({ error: 'Missing recordId or extractedText for analysis.' }, 400, corsHeaders);
    }
    if (extractedText.trim() === "") {
        console.log(`Extracted text for uploaded_file_id ${uploadedFileId} is empty. Marking as analysis_skipped_empty_text.`);
        await supabaseAdminClient.from('uploaded_files').update({ status: 'analysis_skipped_empty_text', error_message: 'Extracted text was empty.' }).eq('id', uploadedFileId);
        return createJsonResponse({ success: true, message: 'Analysis skipped, extracted text was empty.' }, 200, corsHeaders);
    }

    await supabaseAdminClient.from('uploaded_files').update({ status: 'multi_product_identification_inprogress' }).eq('id', uploadedFileId);

    const productNames = await callGeminiToIdentifyProducts(extractedText);
    let productsSuccessfullyAnalyzedCount = 0;
    let productsFailedAnalysisCount = 0;

    if (productNames && productNames.length > 0) {
        console.log(`Identified ${productNames.length} products for analysis from uploaded_file ${uploadedFileId}:`, productNames.join(', '));
        await supabaseAdminClient.from('uploaded_files').update({ status: 'individual_product_analysis_inprogress' }).eq('id', uploadedFileId);

        for (const productName of productNames) {
            let analysisData: any = null;
            let productEmbeddingVec: number[] | null = null;
            let individualErrorMsg: string | null = null;
            let individualStatus = 'analysis_failed'; // Default for this product iteration

            try {
                console.log(`Analyzing product "${productName}" from uploaded_file ${uploadedFileId}...`);
                analysisData = await callGeminiForSingleProductAnalysis(productName, extractedText);
                
                if (analysisData) {
                    let textForEmbeddingInput = "";
                    if (analysisData.product_name) textForEmbeddingInput += `Product Name: ${analysisData.product_name}. `;
                    else textForEmbeddingInput += `Product Name: ${productName}. `; // Use identified name if Gemini misses it
                    if (analysisData.product_type) textForEmbeddingInput += `Type: ${analysisData.product_type}. `;
                    if (analysisData.analysis_summary && analysisData.analysis_summary.trim() !== "") {
                        textForEmbeddingInput += `Summary: ${analysisData.analysis_summary}. `;
                    }
                    if (analysisData.features && Array.isArray(analysisData.features) && analysisData.features.length > 0) {
                        textForEmbeddingInput += `Features: ${analysisData.features.join(', ')}. `;
                    }
                    if (analysisData.pros && Array.isArray(analysisData.pros) && analysisData.pros.length > 0) {
                        textForEmbeddingInput += `Pros: ${analysisData.pros.join(', ')}. `;
                    }
                    if (analysisData.cons && Array.isArray(analysisData.cons) && analysisData.cons.length > 0) {
                        textForEmbeddingInput += `Cons: ${analysisData.cons.join(', ')}. `;
                    }
                    if (analysisData.why_should_i_buy && analysisData.why_should_i_buy.trim() !== "") {
                        textForEmbeddingInput += `Key Selling Points: ${analysisData.why_should_i_buy}`;
                    }
                    
                    textForEmbeddingInput = textForEmbeddingInput.trim();
                    console.log(`Constructed textForEmbeddingInput for "${productName}": "${textForEmbeddingInput.substring(0, 100)}..."`);


                    if (textForEmbeddingInput.length > 0) {
                        productEmbeddingVec = await callGeminiForEmbedding(textForEmbeddingInput);
                    } else {
                        console.warn(`Constructed text for embedding for "${productName}" was empty. Trying full extractedText as fallback.`);
                        if (extractedText && extractedText.trim().length > 0) {
                             console.log(`Using full extractedText as fallback for embedding for "${productName}"`);
                             productEmbeddingVec = await callGeminiForEmbedding(extractedText);
                        } else {
                            console.warn(`No text available to generate embedding for product: ${productName}`);
                        }
                    }
                    individualStatus = 'analysis_complete';
                    productsSuccessfullyAnalyzedCount++;
                } else {
                    individualErrorMsg = `Gemini returned no structured data for product: ${productName}`;
                    productsFailedAnalysisCount++;
                }
            } catch (e) {
                const error = e instanceof Error ? e : new Error(String(e));
                console.error(`Error analyzing product "${productName}" from uploaded_file ${uploadedFileId}:`, error.message);
                individualErrorMsg = error.message;
                productsFailedAnalysisCount++;
            }

            const { error: insertError } = await supabaseAdminClient
                .from('analyzed_products')
                .insert({
                    uploaded_file_id: uploadedFileId,
                    product_name: analysisData?.product_name || productName,
                    product_type: analysisData?.product_type || null,
                    price: analysisData?.price ? String(analysisData.price) : null,
                    discounted_price: analysisData?.discounted_price ? String(analysisData.discounted_price) : null,
                    features: (analysisData?.features && Array.isArray(analysisData.features)) ? analysisData.features : null,
                    pros: (analysisData?.pros && Array.isArray(analysisData.pros)) ? analysisData.pros : null,
                    cons: (analysisData?.cons && Array.isArray(analysisData.cons)) ? analysisData.cons : null,
                    why_should_i_buy: analysisData?.why_should_i_buy || null,
                    analysis_summary: analysisData?.analysis_summary || null,
                    source_text_snippet: analysisData?.source_text_snippet || null,
                    product_embedding: productEmbeddingVec ? `[${productEmbeddingVec.join(',')}]` : null,
                    individual_analysis_status: individualStatus,
                    individual_analysis_error: individualErrorMsg,
                });
            if (insertError) {
                console.error(`Failed to insert analyzed product "${productName}" into DB for uploaded_file ${uploadedFileId}:`, insertError);
                productsFailedAnalysisCount++; // Also count DB insert failure
                // Potentially update the master file record with this specific error too
                await supabaseAdminClient.from('uploaded_files').update({
                    error_message: `Failed to insert analyzed product "${productName}": ${insertError.message}`
                }).eq('id', uploadedFileId);
            }
        } // End of for...of loop

        const finalUploadedFileStatus = productsFailedAnalysisCount > 0 ? 'analysis_complete_with_errors' : 'analysis_complete_all_products';
        await supabaseAdminClient.from('uploaded_files')
          .update({ status: finalUploadedFileStatus, error_message: productsFailedAnalysisCount > 0 ? `${productsFailedAnalysisCount} out of ${productNames.length} products had analysis/storage issues.` : null })
          .eq('id', uploadedFileId);
        return createJsonResponse({ success: true, message: `Analysis of ${productNames.length} products finished. Success: ${productsSuccessfullyAnalyzedCount}, Failed: ${productsFailedAnalysisCount}` }, 200, corsHeaders);
    
    } else if (productNames && productNames.length === 0) {
        console.log(`No distinct products identified in uploaded_file ${uploadedFileId}. Nothing to analyze further.`);
        await supabaseAdminClient.from('uploaded_files').update({ status: 'analysis_no_products_found', error_message: null }).eq('id', uploadedFileId);
        return createJsonResponse({ success: true, message: 'No distinct products identified for analysis.' }, 200, corsHeaders);
    } else { 
         console.error(`Product identification step failed for uploaded_file ${uploadedFileId}. 'productNames' is null.`);
         await supabaseAdminClient.from('uploaded_files').update({ status: 'analysis_failed', error_message: 'Product identification step failed (result was null).' }).eq('id', uploadedFileId);
         return createJsonResponse({ error: 'Product identification failed during analysis.' }, 500, corsHeaders);
    }
  } catch (error) {
    const e = error instanceof Error ? e : new Error(String(error));
    console.error(`General error in ${functionName} for uploaded_file ${requestPayload?.recordId}:`, e.message, e.stack);
     if (requestPayload && requestPayload.recordId) {
        await supabaseAdminClient.from('uploaded_files')
            .update({ status: 'analysis_failed', error_message: `General function error: ${e.message}` })
            .eq('id', requestPayload.recordId);
    }
    return createJsonResponse({ error: e.message || 'Unknown server error in analysis function' }, 500, corsHeaders);
  }
});