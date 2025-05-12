import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

console.log("analyze-embed-support-docs function initializing (v1.0).");

const EMBEDDING_MODEL_NAME = "text-embedding-004"; // Google's latest embedding model
const MAX_CHUNK_SIZE_CHARS = 1500; // Max characters per chunk
const CHUNK_OVERLAP_CHARS = 200;   // Overlap between chunks

// --- Helper: Text Chunking --- 
function chunkText(text: string, maxSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let startIndex = 0;
  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + maxSize, text.length);
    chunks.push(text.substring(startIndex, endIndex));
    startIndex += maxSize - overlap;
    if (startIndex + overlap >= text.length && endIndex < text.length) { // Ensure last part is captured
      // This condition might need refinement to avoid tiny overlaps or re-capturing the very end.
      // For now, it pushes a potentially smaller final chunk if overlap causes it to miss the end.
      if (endIndex < text.length) { // Avoid pushing if already at the end
          chunks.push(text.substring(endIndex - overlap > startIndex ? endIndex - overlap : startIndex));
      }
      break; 
    }
    if (endIndex === text.length) break;
  }
   // A simpler way to ensure the last piece is captured if missed by overlap logic:
   if (chunks.length > 0) {
    const lastChunk = chunks[chunks.length - 1];
    if (text.endsWith(lastChunk) === false && text.length > lastChunk.length) {
      const remainingText = text.substring(text.indexOf(lastChunk) + lastChunk.length - overlap > 0 ? text.indexOf(lastChunk) + lastChunk.length - overlap : 0 );
      if (remainingText.trim().length > 0 && !chunks.some(c => c.endsWith(remainingText.trim()))) {
         // A more robust check for the actual remaining part is needed
         // This simple heuristic adds the rest if it seems significant
         let estimatedEndLastChunk = (chunks.length -1) * (maxSize - overlap) + maxSize;
         if (estimatedEndLastChunk < text.length) {
            chunks.push(text.substring(estimatedEndLastChunk - overlap > 0 ? estimatedEndLastChunk - overlap : 0));
         }
      }
    }
  }
  return chunks.filter(chunk => chunk.trim().length > 0); // Remove empty chunks
}

// --- Helper: Update status in source documents table ---
async function updateSourceDocumentStatus(
  supabaseAdmin: SupabaseClient,
  sourceDocumentId: string,
  status: string,
  errorMessage?: string | null
) {
  const updateData: { processing_status: string; processing_error?: string | null, analyzed_at?: string } = {
    processing_status: status,
    analyzed_at: new Date().toISOString(), // Add a timestamp for when analysis/embedding is done
  };
  if (errorMessage) {
    updateData.processing_error = errorMessage;
  }
  const { error } = await supabaseAdmin
    .from("support_source_documents")
    .update(updateData)
    .eq("id", sourceDocumentId);

  if (error) {
    console.error(`[${sourceDocumentId}] Error updating source document status to ${status}:`, error.message);
  }
}

serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', 
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sourceDocumentId: string | null = null;
  let supabaseAdmin: SupabaseClient;

  // --- Environment Variable Checks & Client Initialization ---
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !geminiApiKey) {
      console.error("Missing environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or GEMINI_API_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error: Missing API keys." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL_NAME });

    // --- Request Body Parsing & Validation ---
    const body = await req.json();
    sourceDocumentId = body.sourceDocumentId;
    const extractedText = body.extractedText;

    if (!sourceDocumentId || typeof extractedText !== 'string') {
      return new Response(JSON.stringify({ error: "Missing sourceDocumentId or extractedText in request body." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (extractedText.trim().length === 0) {
        console.log(`[${sourceDocumentId}] Extracted text is empty. Skipping embedding.`);
        await updateSourceDocumentStatus(supabaseAdmin, sourceDocumentId, "embedding_skipped_empty_text");
        return new Response(JSON.stringify({ message: "Extracted text is empty, embedding skipped.", documentId: sourceDocumentId }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    console.log(`[${sourceDocumentId}] Received text. Length: ${extractedText.length}. Starting chunking and embedding.`);
    await updateSourceDocumentStatus(supabaseAdmin, sourceDocumentId, "embedding_in_progress");

    // --- Text Chunking ---
    const textChunks = chunkText(extractedText, MAX_CHUNK_SIZE_CHARS, CHUNK_OVERLAP_CHARS);
    console.log(`[${sourceDocumentId}] Text divided into ${textChunks.length} chunks.`);
    if (textChunks.length === 0) {
        console.log(`[${sourceDocumentId}] No text chunks to process after chunking.`);
        await updateSourceDocumentStatus(supabaseAdmin, sourceDocumentId, "embedding_skipped_no_chunks");
        return new Response(JSON.stringify({ message: "No text chunks to process after chunking.", documentId: sourceDocumentId }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // --- Embedding Generation & Storage (Batching for Gemini API) ---
    // The embedContents API can take an array of strings.
    // However, there might be limits on the total size or number of strings per request.
    // For simplicity, we'll embed one by one, but batching is better for production.
    
    let successfulEmbeddings = 0;
    for (let i = 0; i < textChunks.length; i++) {
        const chunk = textChunks[i];
        try {
            console.log(`[${sourceDocumentId}] Embedding chunk ${i + 1}/${textChunks.length}...`);
            const result = await embeddingModel.embedContent(chunk);
            const embedding = result.embedding.values; // Array of numbers

            const { error: insertError } = await supabaseAdmin
                .from("support_document_chunks")
                .insert({
                    source_document_id: sourceDocumentId,
                    chunk_text: chunk,
                    embedding: embedding,
                });

            if (insertError) {
                console.error(`[${sourceDocumentId}] Error inserting chunk ${i + 1} into DB:`, insertError.message);
                // Decide if you want to stop or continue. For now, we log and continue.
            } else {
                successfulEmbeddings++;
            }
        } catch (embedError) {
            const e = embedError instanceof Error ? embedError : new Error(String(embedError));
            console.error(`[${sourceDocumentId}] Error embedding chunk ${i + 1}:`, e.message);
            // Log and continue for now. Could implement retries or fail the whole document.
        }
    }
    
    console.log(`[${sourceDocumentId}] Processed ${textChunks.length} chunks. Successfully embedded and stored: ${successfulEmbeddings}.`);

    if (successfulEmbeddings === 0 && textChunks.length > 0) {
        await updateSourceDocumentStatus(supabaseAdmin, sourceDocumentId, "embedding_failed", "All chunks failed to embed or store.");
        return new Response(JSON.stringify({ error: "Failed to embed and store any chunks.", documentId: sourceDocumentId }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } else if (successfulEmbeddings < textChunks.length) {
        await updateSourceDocumentStatus(supabaseAdmin, sourceDocumentId, "embedding_partial_success", `Successfully embedded ${successfulEmbeddings} out of ${textChunks.length} chunks.`);
    } else {
        await updateSourceDocumentStatus(supabaseAdmin, sourceDocumentId, "embedding_completed");
    }

    return new Response(JSON.stringify({
        message: `Embedding process finished. ${successfulEmbeddings}/${textChunks.length} chunks successfully embedded and stored.`, 
        documentId: sourceDocumentId 
    }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const e = error instanceof Error ? error : new Error(String(error));
    console.error(`[${sourceDocumentId || 'N/A'}] General error in analyze-embed-support-docs:`, e.message, e.stack);
    
    // Attempt to update status to failed if sourceDocumentId is available
    if (sourceDocumentId) {
        try {
            // Try to create a new client instance for error reporting, in case the main one failed to initialize
            const supabaseUrlForCatch = Deno.env.get("SUPABASE_URL");
            const supabaseServiceKeyForCatch = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
            if (supabaseUrlForCatch && supabaseServiceKeyForCatch) {
                const supabaseAdminForCatch = createClient(supabaseUrlForCatch, supabaseServiceKeyForCatch);
                await updateSourceDocumentStatus(supabaseAdminForCatch, sourceDocumentId, "embedding_failed", `General function error: ${e.message}`);
            } else {
                console.error(`[${sourceDocumentId}] Cannot update status on error: Supabase URL/Key missing in env for catch block client.`);
            }
        } catch (dbUpdateError) {
            const dbErr = dbUpdateError instanceof Error ? dbUpdateError : new Error(String(dbUpdateError));
            console.error(`[${sourceDocumentId}] Critical error: Failed to update status to 'failed' after unhandled error:`, dbErr.message);
        }
    }
    return new Response(JSON.stringify({ error: `Internal Server Error: ${e.message}` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
