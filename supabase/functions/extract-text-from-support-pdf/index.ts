import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
// pdfjsLib import removed as PDFs are now skipped

console.log("Extract-text-from-support-pdf function initializing (v2 - Google Docs & Text only).");

async function updateDocumentStatus(
  supabaseAdmin: SupabaseClient,
  sourceDocumentId: string,
  status: string,
  extractedText?: string | null,
  errorMessage?: string | null
) {
  const updateData: {
    processing_status: string;
    extracted_text?: string | null;
    processing_error?: string | null;
    processed_at: string;
  } = {
    processing_status: status,
    processed_at: new Date().toISOString(),
  };

  if (extractedText !== undefined) {
    updateData.extracted_text = extractedText;
  }
  if (errorMessage !== undefined) {
    updateData.processing_error = errorMessage;
  }

  const { error: updateError } = await supabaseAdmin
    .from("support_source_documents")
    .update(updateData)
    .eq("id", sourceDocumentId);

  if (updateError) {
    console.error(
      `[${sourceDocumentId}] Error updating document status to ${status}:`,
      updateError
    );
  } else {
    console.log(
      `[${sourceDocumentId}] Document status updated to ${status}.`
    );
  }
}

serve(async (req: Request) => {
  console.log("[Handler] Received request:", req.method, req.url);
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Adjust as needed for security
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
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  let supabaseAdmin: SupabaseClient;

  try {
    supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
    });
  } catch (e) {
    const clientError = e instanceof Error ? e : new Error(String(e));
    console.error("Failed to create Supabase client:", clientError.message);
    return new Response(JSON.stringify({ error: `Server configuration error (client creation): ${clientError.message}` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    console.log("[Handler] Request body:", body);

    const {
      bucketName,
      storagePath,
      mimeType,
      sourceDocumentId: docId, 
    } = body;
    sourceDocumentId = docId; 

    if (!bucketName || !storagePath || !mimeType || !sourceDocumentId) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameters: bucketName, storagePath, mimeType, or sourceDocumentId.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`[${sourceDocumentId}] Processing started. MimeType: ${mimeType}, Path: ${storagePath}`);
    await updateDocumentStatus(supabaseAdmin, sourceDocumentId, "processing");

    console.log(`[${sourceDocumentId}] Downloading from ${bucketName}/${storagePath}...`);
    const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
      .from(bucketName)
      .download(storagePath);

    if (downloadError) {
      console.error(`[${sourceDocumentId}] Error downloading file:`, downloadError);
      await updateDocumentStatus(supabaseAdmin, sourceDocumentId, "failed", null, `Download failed: ${downloadError.message}`);
      return new Response(JSON.stringify({ error: `Failed to download file: ${downloadError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!fileBlob) {
      console.error(`[${sourceDocumentId}] Downloaded file blob is null.`);
      await updateDocumentStatus(supabaseAdmin, sourceDocumentId, "failed", null, "Downloaded file blob is null.");
      return new Response(JSON.stringify({ error: "Downloaded file blob is null." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.log(`[${sourceDocumentId}] File downloaded successfully. Size: ${fileBlob.size} bytes.`);

    let extractedText: string | null = null;
    let processingErrorMsg: string | null = null;
    let finalStatus = "completed"; 

    const fileContentArrayBuffer = await fileBlob.arrayBuffer();

    if (mimeType.startsWith("text/") || mimeType === "application/vnd.google-apps.document") {
      console.log(`[${sourceDocumentId}] Extracting text from ${mimeType}...`);
      try {
        if (fileContentArrayBuffer.byteLength === 0) {
          console.log(`[${sourceDocumentId}] File ${storagePath} is empty (0 bytes).`);
          extractedText = ""; 
        } else {
          extractedText = new TextDecoder().decode(fileContentArrayBuffer);
        }
        console.log(`[${sourceDocumentId}] Text extracted. Length: ${extractedText?.length ?? 0}`);
        finalStatus = "completed";
      } catch (decodeError) {
        const e = decodeError instanceof Error ? decodeError : new Error(String(decodeError));
        console.error(`[${sourceDocumentId}] Text decoding error:`, e);
        processingErrorMsg = `Text decoding error: ${e.message}`;
        finalStatus = "failed";
      }
    } else if (mimeType === "application/pdf") {
      console.log(`[${sourceDocumentId}] PDF file type received. Skipping text extraction for PDFs.`);
      processingErrorMsg = "PDF text extraction is skipped by design."; // Informative message
      finalStatus = "pdf_skipped"; // Custom status for clarity
      extractedText = null; // Ensure no text is stored
    } else {
      // All other types are considered unsupported for extraction
      processingErrorMsg = `Unsupported MIME type for text extraction: ${mimeType}. Only Google Docs and text files are processed.`;
      console.warn(`[${sourceDocumentId}] ${processingErrorMsg}`);
      finalStatus = "unsupported_type"; 
      extractedText = null;
    }

    await updateDocumentStatus(supabaseAdmin, sourceDocumentId, finalStatus, extractedText, processingErrorMsg);

    // --- Invoke analyze-embed-support-docs if extraction was successful ---
    if (finalStatus === "completed" && extractedText && extractedText.trim().length > 0) {
      console.log(`[${sourceDocumentId}] Text extraction successful. Triggering analyze-embed-support-docs function.`);
      // Intentionally not awaiting this promise - fire and forget
      supabaseAdmin.functions.invoke("analyze-embed-support-docs", {
        body: {
          sourceDocumentId: sourceDocumentId,
          extractedText: extractedText,
        },
      })
      .then(response => {
        if (response.error) {
          console.error(`[${sourceDocumentId}] Error invoking analyze-embed-support-docs:`, response.error);
          // Optionally, update source_document_documents status to indicate invocation failure
        } else {
          console.log(`[${sourceDocumentId}] Successfully invoked analyze-embed-support-docs. Response status:`, response.data?.status || response.status );
        }
      })
      .catch(invokeError => {
        console.error(`[${sourceDocumentId}] Critical error trying to invoke analyze-embed-support-docs:`, invokeError);
      });
    } else {
      console.log(`[${sourceDocumentId}] Analysis/embedding step skipped. Status: ${finalStatus}, Extracted Text Empty: ${!extractedText || extractedText.trim().length === 0}`);
    }

    // Prepare response based on outcome
    let responseStatus = 200;
    let responseBody: Record<string, any> = {
        message: `File processed. Status: ${finalStatus}.`,
        documentId: sourceDocumentId,
        status: finalStatus
    };

    if (finalStatus === "completed") {
        responseBody.extractedLength = extractedText?.length ?? 0;
    } else if (finalStatus === "failed" || finalStatus === "unsupported_type") {
        responseStatus = finalStatus === "unsupported_type" ? 415 : 500; // 415 for unsupported, 500 for general fail
        responseBody.error = processingErrorMsg || "Text extraction failed or file type not supported.";
    } else if (finalStatus === "pdf_skipped") {
        responseBody.message = `PDF processing skipped as per configuration. Document ID: ${sourceDocumentId}`;
        // responseStatus can remain 200 for skipped as it's an expected outcome
    }
    
    if(processingErrorMsg && finalStatus !== "pdf_skipped" && finalStatus !== "unsupported_type") {
        // Add error to message if it's a general failure and not a specific skip/unsupported case
        responseBody.message += ` Error: ${processingErrorMsg}`;
    }
    responseBody.message = responseBody.message.trim();

    console.log(`[${sourceDocumentId}] Processing finished. Final status: ${finalStatus}.`);
    return new Response(JSON.stringify(responseBody),
      { status: responseStatus, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const e = error instanceof Error ? error : new Error(String(error));
    console.error(`[${sourceDocumentId || 'UNKNOWN_ID'}] Unhandled error:`, e);
    const errorMessage = e.message || "An unknown error occurred.";
    
    if (sourceDocumentId) {
      try {
        if (!supabaseAdmin) {
            supabaseAdmin = createClient(supabaseUrl, serviceKey, {
              auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
            });
        }
        await updateDocumentStatus(supabaseAdmin, sourceDocumentId, "failed", null, `Unhandled error: ${errorMessage}`);
      } catch (dbUpdateError) {
        const dbErr = dbUpdateError instanceof Error ? dbUpdateError : new Error(String(dbUpdateError));
        console.error(`[${sourceDocumentId}] Critical: Failed to update status to 'failed' after unhandled error:`, dbErr.message);
      }
    }
    
    return new Response(JSON.stringify({ error: `Internal Server Error: ${errorMessage}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
