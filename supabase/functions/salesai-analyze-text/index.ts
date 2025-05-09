// supabase/functions/salesai-analyze-text/index.ts
import { serve, ConnInfo } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log('SalesAI Analyze Text (Gemini) Edge Function initializing (v1.1 - Multi-Product)...');

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
    if (!text || text.trim() === "") return []; // Return empty array if no text

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
    if (!response.ok) { /* ... error handling ... */ }
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
                return []; // Treat as no products found if structure is wrong
            }
        } catch (e) { /* ... error handling, return [] ... */ 
            console.error("Failed to parse JSON for product names:", e, "Raw:", jsonString);
            return [];
        }
    }
    throw new Error("Unexpected Gemini product identification response.");
}

async function callGeminiForSingleProductAnalysis(productName: string, fullContextText: string): Promise<any | null> {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set.");
    // For a more focused analysis, you might try to find snippets related to productName in fullContextText.
    // For now, we use fullContextText but tell Gemini to focus.
    const prompt = `
    Analyze *only* the product named "${productName}" based on the provided "Full Context Text".
    Provide the output as a single, valid JSON object.
    Keys: "product_name" (string, should be "${productName}"), "product_type" (string), "price" (string), 
    "discounted_price" (string|null), "features" (string[]), "pros" (string[]), "cons" (string[]), 
    "why_should_i_buy" (string), "analysis_summary" (string).
    If info not found for "${productName}", use null or empty array. Do not add text before/after JSON.

    Full Context Text:
    ---
    ${fullContextText.substring(0, 15000)}
    ---
    JSON Output for product "${productName}":`;

    console.log(`Calling Gemini (${GEMINI_ANALYSIS_MODEL_ID}) for analysis of "${productName}".`);
    const requestUrl = `${GOOGLE_API_BASE_URL}/${GEMINI_ANALYSIS_MODEL_ID}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(requestUrl, { /* ... POST request as in previous callGeminiForAnalysis ... */ 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 2048 }
        }),
    });
    if (!response.ok) { /* ... error handling ... */ }
    const result = await response.json();
    if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
        const jsonString = result.candidates[0].content.parts[0].text;
        try {
            const cleaned = jsonString.replace(/^```json\s*|\s*```$/g, '').trim();
            return JSON.parse(cleaned);
        } catch (e) { /* ... error handling ... */ }
    }
    throw new Error(`Unexpected Gemini analysis response for ${productName}.`);
}

async function callGeminiForEmbedding(textToEmbed: string): Promise<number[] | null> {
    // ... This function remains largely the same as the last full version you had ...
    // ... Ensure GEMINI_EMBEDDING_MODEL_ID and request structure are correct ...
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY for embedding not set.");
    if (!textToEmbed || textToEmbed.trim() === "") return null;
    const trimmedText = textToEmbed.substring(0, 8000);

    console.log(`Calling Gemini (${GEMINI_EMBEDDING_MODEL_ID}) for embedding. Text length: ${trimmedText.length}`);
    const requestUrl = `${GOOGLE_API_BASE_URL}/${GEMINI_EMBEDDING_MODEL_ID}:embedContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(requestUrl, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: `models/${GEMINI_EMBEDDING_MODEL_ID}`, content: { parts: [{ text: trimmedText }] } }),
    });
    if (!response.ok) { /* ... error handling ... */ }
    const result = await response.json();
    if (result.embedding?.values) return result.embedding.values;
    throw new Error("Unexpected Gemini embedding response.");
}

serve(async (req: Request, _connInfo: ConnInfo): Promise<Response> => {
  const functionName = 'salesai-analyze-text';
  let supabaseAdminClient: SupabaseClient; // Defined here
  let requestPayload : RequestBody; // Defined here

  try {
    const supabaseUrlEnv = Deno.env.get('SUPABASE_URL');
    const serviceKeyEnv = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrlEnv || !serviceKeyEnv || !GEMINI_API_KEY) {
         console.error(`Missing env vars in ${functionName}.`);
         return createJsonResponse({ error: 'Server configuration error.' }, 500, corsHeaders);
    }
    supabaseAdminClient = createClient(supabaseUrlEnv, serviceKeyEnv, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }});
    
    if (!req.body) return createJsonResponse({ error: 'Request body missing' }, 400, corsHeaders);
    try { requestPayload = await req.json(); } catch (e) { return createJsonResponse({ error: 'Invalid JSON' }, 400, corsHeaders); }
    
    const { recordId: uploadedFileId, extractedText } = requestPayload; // Renamed recordId for clarity
    console.log(`Analyzing text for uploaded_files.id: ${uploadedFileId}.`);

    if (!uploadedFileId || typeof extractedText !== 'string' || extractedText.trim() === "") {
        await supabaseAdminClient.from('uploaded_files').update({ status: 'analysis_skipped_empty_text', error_message: 'Extracted text was empty or missing for analysis.' }).eq('id', uploadedFileId);
        return createJsonResponse({ success: true, message: 'Analysis skipped, no text.' }, 200, corsHeaders);
    }

    // Status on uploaded_files was already set to 'pending_full_analysis'
    // Now set to 'multi_product_identification_inprogress'
    await supabaseAdminClient.from('uploaded_files').update({ status: 'multi_product_identification_inprogress' }).eq('id', uploadedFileId);

    const productNames = await callGeminiToIdentifyProducts(extractedText);
    let productsAnalyzedCount = 0;
    let productsFailedCount = 0;

    if (productNames && productNames.length > 0) {
        console.log(`Identified ${productNames.length} products for analysis from uploaded_file ${uploadedFileId}:`, productNames.join(', '));
        await supabaseAdminClient.from('uploaded_files').update({ status: 'individual_product_analysis_inprogress' }).eq('id', uploadedFileId);

        for (const productName of productNames) {
            let analysisData: any = null;
            let productEmbeddingVec: number[] | null = null;
            let individualErrorMsg: string | null = null;
            let individualStatus = 'analysis_failed';

            try {
                console.log(`Analyzing product "${productName}" from uploaded_file ${uploadedFileId}...`);
                analysisData = await callGeminiForSingleProductAnalysis(productName, extractedText);
                
                if (analysisData) {
                    let textForEmbeddingInput = `${analysisData.product_name || productName} ${analysisData.product_type || ''} ${(analysisData.features || []).join('; ')} ${analysisData.analysis_summary || ''}`.trim();
                    if (textForEmbeddingInput) {
                        productEmbeddingVec = await callGeminiForEmbedding(textForEmbeddingInput);
                    }
                    individualStatus = 'analysis_complete';
                    productsAnalyzedCount++;
                } else {
                    individualErrorMsg = `Gemini returned no structured data for product: ${productName}`;
                    productsFailedCount++;
                }
            } catch (e) {
                const error = e instanceof Error ? e : new Error(String(e));
                console.error(`Error analyzing product "${productName}" from uploaded_file ${uploadedFileId}:`, error.message);
                individualErrorMsg = error.message;
                productsFailedCount++;
            }

            // Insert a new row into analyzed_products
            const { error: insertError } = await supabaseAdminClient
                .from('analyzed_products')
                .insert({
                    uploaded_file_id: uploadedFileId,
                    product_name: analysisData?.product_name || productName, // Use identified name if Gemini doesn't return one
                    product_type: analysisData?.product_type || null,
                    price: String(analysisData?.price || ''),
                    discounted_price: String(analysisData?.discounted_price || ''),
                    features: (analysisData?.features && Array.isArray(analysisData.features)) ? analysisData.features : null,
                    pros: (analysisData?.pros && Array.isArray(analysisData.pros)) ? analysisData.pros : null,
                    cons: (analysisData?.cons && Array.isArray(analysisData.cons)) ? analysisData.cons : null,
                    why_should_i_buy: analysisData?.why_should_i_buy || null,
                    analysis_summary: analysisData?.analysis_summary || null,
                    product_embedding: productEmbeddingVec ? `[${productEmbeddingVec.join(',')}]` : null,
                    individual_analysis_status: individualStatus,
                    individual_analysis_error: individualErrorMsg,
                    source_text_snippet: null, // TODO: Optionally add logic to extract relevant snippet
                });
            if (insertError) {
                console.error(`Failed to insert analyzed product "${productName}" into DB for uploaded_file ${uploadedFileId}:`, insertError);
                productsFailedCount++; // Count this as a failure too
            }
        }
        // Update the master uploaded_files record
        const finalUploadedFileStatus = productsFailedCount > 0 ? 'analysis_complete_with_errors' : 'analysis_complete_all_products';
        await supabaseAdminClient.from('uploaded_files')
          .update({ status: finalUploadedFileStatus, error_message: productsFailedCount > 0 ? `${productsFailedCount} products had analysis issues.` : null })
          .eq('id', uploadedFileId);
        return createJsonResponse({ success: true, message: `Analysis of ${productNames.length} products finished. Success: ${productsAnalyzedCount}, Failed: ${productsFailedCount}` }, 200, corsHeaders);
    
    } else if (productNames && productNames.length === 0) {
        console.log(`No distinct products identified in uploaded_file ${uploadedFileId}. Nothing to analyze further.`);
        await supabaseAdminClient.from('uploaded_files').update({ status: 'analysis_no_products_found' }).eq('id', uploadedFileId);
        return createJsonResponse({ success: true, message: 'No distinct products identified for analysis.' }, 200, corsHeaders);
    } else { // productNames is null, identification failed
         console.error(`Product identification step failed for uploaded_file ${uploadedFileId}.`);
         await supabaseAdminClient.from('uploaded_files').update({ status: 'analysis_failed', error_message: 'Product identification step failed.' }).eq('id', uploadedFileId);
         return createJsonResponse({ error: 'Product identification failed during analysis.' }, 500, corsHeaders);
    }
  } catch (error) {
    const e = error instanceof Error ? e : new Error(String(e));
    console.error(`General error in ${functionName} for uploaded_file ${requestPayload?.recordId}:`, e.message, e.stack);
     if (requestPayload && requestPayload.recordId) {
        await supabaseAdminClient.from('uploaded_files') // Update the main file record
            .update({ status: 'analysis_failed', error_message: `General function error: ${e.message}` })
            .eq('id', requestPayload.recordId);
    }
    return createJsonResponse({ error: e.message || 'Unknown server error in analysis function' }, 500, corsHeaders);
  }
});