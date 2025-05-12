// src/app/api/sales-ai/search-in-document/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js'; // Standard Supabase client for Node.js

// Environment variables should be in your .env.local
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

// TODO: Confirm your exact embedding model ID and ensure it matches the one used for ingestion
const GEMINI_EMBEDDING_MODEL_ID = "text-embedding-004"; 
const GOOGLE_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";


if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
    // console.error("SEARCH-IN-DOC API (Direct): Missing critical environment variables. Check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY.");
}

async function getQueryEmbeddingDirect(queryText: string): Promise<number[] | null> {
    if (!GEMINI_API_KEY) {
        // console.error("SEARCH-IN-DOC API (Direct): GEMINI_API_KEY is not set for embedding.");
        throw new Error("Server configuration error: Missing Gemini API key.");
    }
    if (!queryText || queryText.trim() === "") {
        // console.log("SEARCH-IN-DOC API (Direct): Query text for embedding is empty.");
        return null;
    }
    const trimmedTextToEmbed = queryText.substring(0, 8000); // Respect model limits

    // console.log(`SEARCH-IN-DOC API (Direct): Calling Gemini (${GEMINI_EMBEDDING_MODEL_ID}) for query embedding. Text: "${trimmedTextToEmbed.substring(0, 50)}..."`);
    const requestUrl = `${GOOGLE_API_BASE_URL}/${GEMINI_EMBEDDING_MODEL_ID}:embedContent?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(requestUrl, {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: `models/${GEMINI_EMBEDDING_MODEL_ID}`,
                content: { parts: [{ text: trimmedTextToEmbed }] },
            }),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            // console.error("SEARCH-IN-DOC API (Direct): Gemini API error (Query Embedding):", response.status, errorBody);
            throw new Error(`Gemini embedding API request failed (${response.status}): ${errorBody}`);
        }
        const result = await response.json();
        if (result.embedding && result.embedding.values && Array.isArray(result.embedding.values)) {
            // console.log(`SEARCH-IN-DOC API (Direct): Query embedding received. Vector dimension: ${result.embedding.values.length}`);
            return result.embedding.values;
        } else {
            // console.error("SEARCH-IN-DOC API (Direct): Unexpected Gemini embedding response structure for query:", result);
            throw new Error("Unexpected Gemini embedding response structure or missing values for query.");
        }
    } catch (error) {
        // console.error("SEARCH-IN-DOC API (Direct): Error in getQueryEmbeddingDirect:", error);
        throw error; // Re-throw to be caught by the main handler
    }
}

export async function POST(req: NextRequest) {
    const functionName = "search-in-document-api-direct";
    // console.log(`${functionName}: Received POST request.`);
    let supabase: SupabaseClient;

    try {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Server configuration error: Missing Supabase URL or Service Key.");
        }
        supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        const body = await req.json();
        const userQuery: string = body.query;
        const uploadedFileId: string = body.uploadedFileId;
        const matchCount: number = body.count || 6;
        const similarityThreshold: number = body.threshold || 0.5; 

        if (!userQuery || typeof userQuery !== 'string' || userQuery.trim() === "") {
            // console.warn(`${functionName}: Missing or empty user query.`);
            return NextResponse.json({ error: 'Search query is missing or empty.' }, { status: 400 });
        }
        if (!uploadedFileId || typeof uploadedFileId !== 'string' || uploadedFileId.trim() === "") {
            // console.warn(`${functionName}: Missing or empty uploadedFileId.`);
            return NextResponse.json({ error: 'Document ID (uploadedFileId) is missing or empty.' }, { status: 400 });
        }

        // console.log(`${functionName}: Query: "${userQuery}", File ID: ${uploadedFileId}, Count: ${matchCount}, Threshold: ${similarityThreshold}`);

        // 1. Get embedding for the user's query directly
        const queryEmbeddingVector = await getQueryEmbeddingDirect(userQuery);

        if (!queryEmbeddingVector) {
            // console.error(`${functionName}: Failed to generate query embedding.`);
            return NextResponse.json({ error: 'Failed to process query (embedding generation failed).' }, { status: 500 });
        }

        const queryEmbeddingString = `[${queryEmbeddingVector.join(',')}]`;

        // 2. Call the PostgreSQL function to find matching products
        // console.log(`${functionName}: Calling RPC 'match_document_products'.`);
        const { data: rpcResults, error: rpcError } = await supabase.rpc('match_document_products', {
            p_uploaded_file_id: uploadedFileId,
            p_query_embedding: queryEmbeddingString,
            p_match_threshold: similarityThreshold, 
            p_match_count: matchCount
        });

        if (rpcError) {
            // console.error(`${functionName}: Supabase RPC Error for 'match_document_products':`, rpcError);
            return NextResponse.json({ error: `Database search error: ${rpcError.message}`, details: rpcError.details }, { status: 500 });
        }

        // console.log(`${functionName}: Found ${rpcResults?.length || 0} matching products from RPC.`);
        return NextResponse.json({ success: true, results: rpcResults || [] }, { status: 200 });

    } catch (error: any) {
        // console.error(`${functionName}: Error in POST handler:`, error.message);
        // console.error(`${functionName}: Error stack:`, error.stack);
        let message = "An unexpected error occurred during search within the document.";
        if (error.message) {
            message = error.message;
        }
        return NextResponse.json({ error: message, details: error.toString() }, { status: 500 });
    }
}
