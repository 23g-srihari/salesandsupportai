// supabase/functions/salesai-extracted-text/YOUR_ENTRYPOINT_FILE1.ts
import { serve, ConnInfo } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log('SalesAI Extracted Text Edge Function initializing (v4.0 - Multi-Product Pipeline)...');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RequestBody {
  storagePath: string;
  recordId: string | number; // This is the ID from the 'uploaded_files' table
  bucketName: string;
  mimeType: string;
}

function createJsonResponse(body: Record<string, any> | string, status: number, currentCorsHeaders: Record<string, string>): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    headers: { ...currentCorsHeaders, 'Content-Type': 'application/json' },
    status: status,
  });
}

serve(async (req: Request, _connInfo: ConnInfo): Promise<Response> => {
  const functionName = 'salesai-extracted-text'; 
  console.log(`Request received by ${functionName}: ${req.method}`);

  if (req.method === 'OPTIONS') {
    console.log(`Responding to OPTIONS request for ${functionName}`);
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    const errorMsg = `Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ${functionName}.`;
    console.error(errorMsg);
    return createJsonResponse({ error: `Server configuration error: ${errorMsg}` }, 500, corsHeaders);
  }

  let supabaseAdminClient: SupabaseClient;
  try {
    supabaseAdminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
    });
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    console.error(`Failed to create Supabase client for ${functionName}:`, error.message);
    return createJsonResponse({ error: `Server configuration error (client creation): ${error.message}` }, 500, corsHeaders);
  }

  let requestPayload: RequestBody | null = null;
  try {
    if (!req.body) {
        console.error(`Request body is null for ${functionName}.`);
        return createJsonResponse({ error: 'Request body is missing.' }, 400, corsHeaders);
    }
    try { 
        requestPayload = await req.json(); 
    } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        console.error(`Failed to parse request body as JSON in ${functionName}:`, error.message);
        return createJsonResponse({ error: 'Invalid request body: could not parse JSON.' }, 400, corsHeaders);
    }
    
    const { recordId, storagePath, bucketName, mimeType } = requestPayload; // recordId is for uploaded_files table
    console.log(`Processing for ${functionName}: uploaded_files.id=${recordId}, path=${storagePath}, bucket=${bucketName}, mimeType=${mimeType}`);

    if (!storagePath || typeof recordId === 'undefined' || !bucketName || !mimeType) {
      console.error(`Missing parameters in request body for ${functionName}:`, requestPayload);
      return createJsonResponse({ error: 'Missing parameters: storagePath, recordId, bucketName, or mimeType must be provided.' }, 400, corsHeaders);
    }

    await supabaseAdminClient.from('uploaded_files') // Corrected table name
      .update({ status: 'extraction_in_progress', error_message: null })
      .eq('id', recordId);
    
    console.log(`Downloading file for ${functionName}: ${bucketName}/${storagePath}`);
    const { data: fileBlob, error: downloadError } = await supabaseAdminClient.storage
      .from(bucketName)
      .download(storagePath);

    if (downloadError) { 
        console.error(`Error downloading file ${storagePath} in ${functionName}:`, downloadError);
        await supabaseAdminClient.from('uploaded_files').update({ status: 'extraction_failed', error_message: `Download failed: ${downloadError.message}` }).eq('id', recordId);
        return createJsonResponse({ error: `Download failed: ${downloadError.message}` }, 500, corsHeaders);
    }
    if (!fileBlob) { 
        console.error(`Downloaded file blob is null for ${storagePath} in ${functionName}.`);
        await supabaseAdminClient.from('uploaded_files').update({ status: 'extraction_failed', error_message: 'Downloaded file data is null or file is empty.'}).eq('id', recordId);
        return createJsonResponse({ error: 'Downloaded file data is null or file is empty.' }, 500, corsHeaders);
    }

    console.log(`File downloaded by ${functionName}. Size: ${fileBlob.size} bytes.`);
    const fileContentArrayBuffer: ArrayBuffer = await fileBlob.arrayBuffer();
    let extractedText: string | null = null;
    let extractionErrorMsg: string | null = null;
    let finalFileStatus = 'extraction_failed'; // Status for the uploaded_files record

    if (mimeType === 'application/pdf') {
      console.log(`PDF received by ${functionName}. Text extraction for PDFs is currently stubbed/skipped.`);
      finalFileStatus = 'pdf_extraction_skipped'; // This file is skipped for text extraction
      extractedText = null; // No text to pass for analysis
    } else if (
        mimeType === 'text/plain' || 
        mimeType.startsWith('text/') || 
        mimeType === 'application/vnd.google-apps.document' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
      console.log(`Extracting text from ${mimeType} in ${functionName}...`);
      try {
        if (fileContentArrayBuffer.byteLength === 0) {
            console.log(`File ${storagePath} is empty (0 bytes), treating as empty text for ${functionName}.`);
            extractedText = ''; // Empty text is still "extracted"
        } else {
            extractedText = new TextDecoder().decode(fileContentArrayBuffer);
        }
        console.log(`Text extracted by ${functionName}. Length: ${extractedText.length}`);
        finalFileStatus = 'text_extracted'; // Text is ready, analysis can be pending
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        console.error(`Text decoding error in ${functionName}:`, e);
        extractionErrorMsg = `Text decoding error: ${e.message}`;
        finalFileStatus = 'extraction_failed'; 
      }
    } else {
      console.warn(`Unsupported mimeType in ${functionName}: ${mimeType}`);
      extractionErrorMsg = `Unsupported file type for text extraction: ${mimeType}`;
      finalFileStatus = 'unsupported_type'; 
    }
    
    console.log(`Updating uploaded_files table for id ${recordId} by ${functionName}. Status: ${finalFileStatus}.`);
    const { error: updateDbErrorExtract } = await supabaseAdminClient.from('uploaded_files')
      .update({
        extracted_text: extractedText, 
        status: finalFileStatus, 
        error_message: extractionErrorMsg,
      })
      .eq('id', recordId);

    if (updateDbErrorExtract) { 
      console.error(`DB update error (extraction part) for ${recordId} by ${functionName}:`, updateDbErrorExtract);
    }

    // ----- Invoke salesai-analyze-text function IF text was successfully extracted AND is not empty -----
    if (finalFileStatus === 'text_extracted' && extractedText !== null && extractedText.trim() !== '') {
      console.log(`Attempting to invoke salesai-analyze-text for uploaded_files.id: ${recordId}`);
      await supabaseAdminClient.from('uploaded_files') // Update status of the main file record
        .update({ status: 'pending_full_analysis', error_message: null }) 
        .eq('id', recordId);

      supabaseAdminClient.functions.invoke('salesai-analyze-text', {
        body: {
          recordId: recordId, // This is the ID of the row in 'uploaded_files'
          extractedText: extractedText 
        }
      }).then(async response => {
        if (response.error) {
          console.error(`Error response from invoking salesai-analyze-text for ${recordId}:`, response.error);
          await supabaseAdminClient.from('uploaded_files') // Update the main file record status
            .update({ status: 'analysis_invocation_failed', error_message: `Invoking analysis function failed: ${response.error.message || 'Unknown error'}` })
            .eq('id', recordId);
        } else {
          console.log(`salesai-analyze-text function invoked for ${recordId}. Response:`, response.data);
          // The salesai-analyze-text function will manage its own status updates on 'analyzed_products'
          // and can update 'uploaded_files' status to 'analysis_processing_complete' when done.
        }
      }).catch(async invocationError => {
         const e = invocationError instanceof Error ? invocationError : new Error(String(invocationError));
         console.error(`Critical error calling salesai-analyze-text for ${recordId}:`, e.message);
         await supabaseAdminClient.from('uploaded_files') // Update the main file record status
            .update({ status: 'analysis_invocation_failed', error_message: `Critical failure invoking analysis: ${e.message}` })
            .eq('id', recordId);
      });
    } else {
        console.log(`Analysis not triggered for uploaded_files.id ${recordId}. Extraction Status: ${finalFileStatus}, Extracted Text Empty or Null: ${extractedText === null || extractedText.trim() === ''}`);
        // If no text extracted or PDF skipped, no further analysis call needed from here.
        // The status on 'uploaded_files' is already set (e.g., pdf_extraction_skipped, extraction_failed).
    }

    return createJsonResponse({ success: true, message: `Extraction by ${functionName} complete. File status: ${finalFileStatus}. Analysis (if applicable) triggered.`, recordId }, 200, corsHeaders);
  
  } catch (error) { 
    const e = error instanceof Error ? e : new Error(String(error));
    console.error(`General error in ${functionName} for recordId ${requestPayload?.recordId}:`, e.message, e.stack);
    if (requestPayload && requestPayload.recordId) { // If we have a recordId, try to mark it as failed
        await supabaseAdminClient.from('uploaded_files')
            .update({ status: 'extraction_failed', error_message: `General function error: ${e.message}` })
            .eq('id', requestPayload.recordId);
    }
    return createJsonResponse({ error: e.message || 'Unknown server error in extraction function' }, 500, corsHeaders);
  }
});