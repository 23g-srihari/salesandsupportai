import { NextRequest, NextResponse } from 'next/server';
// Import the getSupabaseAdmin function to ensure we use the admin client
import { getSupabaseAdmin } from '@/utils/supabaseClient';

export async function POST(req: NextRequest) {
  // Initialize the Supabase client with admin privileges for this server-side route
  // This will throw an error if SUPABASE_SERVICE_ROLE_KEY is not set, which is good for early detection.
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (error: any) {
    console.error("Failed to initialize Supabase admin client:", error.message);
    return NextResponse.json({ error: "Server configuration error. Cannot connect to backend services." }, { status: 500 });
  }

  try {
    const { files, uploaded_by } = await req.json();

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'No files provided for upload.' }, { status: 400 });
    }

    const BUCKET_NAME = 'drivefiles'; // Standard bucket name - MAKE SURE THIS BUCKET EXISTS IN SUPABASE
    const uploadResults = [];

    for (const file of files) {
      let fileDataForUpload: Buffer | string | null = null; // Initialize to null
      let actualContentType = file.mime_type;
      let storagePath = null;
      let uploadError = null;
      let currentStatus = 'pending_upload'; // Initial status for this file

      // Sanitize filename for storage path construction
      const safeFileName = (file.name || 'untitled').replace(/[^a-zA-Z0-9._-]/g, '_');
      const userPrefix = uploaded_by ? `${uploaded_by.replace(/[^a-zA-Z0-9@._-]/g, '_')}/` : 'unknown_user/';
      const fileNameInBucket = `${userPrefix}${Date.now()}_${safeFileName}`;

      try {
        if (!file.content) {
          uploadError = 'File content is missing.';
          currentStatus = 'failed_upload';
        } else if (file.mime_type === 'application/pdf' && typeof file.content === 'string' && file.content.startsWith('data:application/pdf;base64,')) {
          const base64Data = file.content.replace(/^data:application\/pdf;base64,/, '');
          fileDataForUpload = Buffer.from(base64Data, 'base64');
          actualContentType = 'application/pdf';
        } else if ((file.mime_type === 'text/plain' || file.mime_type === 'application/vnd.google-apps.document') && typeof file.content === 'string') {
          // Google Docs are converted to plain text by the client-side fetchFileContent
          fileDataForUpload = file.content;
          actualContentType = 'text/plain';
        } else {
          uploadError = `Unsupported file type (${file.mime_type}) or unexpected content format.`;
          currentStatus = 'failed_upload';
        }

        // Ensure fileDataForUpload is set before attempting upload
        if (!uploadError && fileDataForUpload !== null) {
          const { data: storageData, error: storageError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileNameInBucket, fileDataForUpload, {
              contentType: actualContentType,
              upsert: false, // Set to true if you want to overwrite existing files with the same path
            });

          if (storageError) {
            console.error('Supabase Storage Error:', storageError);
            uploadError = storageError.message;
            currentStatus = 'failed_upload';
          } else {
            storagePath = storageData.path;
            currentStatus = 'uploaded_to_storage';
          }
        } else if (!uploadError && fileDataForUpload === null) {
            // This condition will be true if file.content was missing or type was unsupported
            // uploadError should already be set in those cases.
            if (!uploadError) { // Set a generic error if not already set
                uploadError = 'File content could not be prepared for upload due to missing content or unsupported type.';
                currentStatus = 'failed_upload';
            }
        }
      } catch (e: any) {
        console.error('Error during file processing or upload:', e);
        uploadError = e.message || 'Unknown error during file processing.';
        currentStatus = 'failed_upload';
      }
      
      uploadResults.push({
        // Keep original client-provided data for reference in response if needed
        original_file_info: { ...file, content: undefined }, // remove content from here for safety
        
        // Data to be inserted into the database
        db_name: file.name || 'untitled',
        db_original_drive_id: file.path, // Google Drive ID (from client's file.path)
        db_storage_bucket: BUCKET_NAME,
        db_storage_path: storagePath,
        db_mime_type: file.mime_type, // Original mime_type from Drive
        db_actual_content_type: actualContentType, // Type used for upload
        db_size_bytes: file.size_bytes,
        db_upload_error_message: uploadError,
        db_status: currentStatus,
      });
    }

    // Prepare rows for the database insert
    const dbRows = uploadResults.map(result => ({
      name: result.db_name,
      original_drive_id: result.db_original_drive_id,
      storage_bucket: result.db_storage_bucket,
      storage_path: result.db_storage_path,
      mime_type: result.db_mime_type, // Store the original mimeType from Drive
      // actual_content_type: result.db_actual_content_type, // Optional: if you want to store the type used for upload
      size_bytes: result.db_size_bytes,
      uploaded_by: uploaded_by || null,
      status: result.db_status,
      error_message: result.db_upload_error_message,
      analysis_result: null, // Default for new uploads
      // Ensure 'content' field is NOT included if it exists in your table from before
    }));

    if (dbRows.length === 0) {
        return NextResponse.json({ warning: 'No files were processed for database insertion.', upload_details: uploadResults }, { status: 200 });
    }
    
    const { data: dbData, error: dbError } = await supabase.from('sales_ai').insert(dbRows).select();

    if (dbError) {
      console.error('Supabase DB Insert Error:', dbError);
      return NextResponse.json({ 
        error: `Database insert error: ${dbError.message}`, 
        upload_details: uploadResults 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Files processed. Check details for individual statuses.',
      data: dbData, // Records from DB insert
      upload_details: uploadResults.map(r => ({ // Cleaned up response for client
          name: r.db_name,
          status: r.db_status,
          storage_path: r.db_storage_path,
          error: r.db_upload_error_message
      }))
    });

  } catch (err: any) {
    console.error('Overall Upload API error:', err);
    return NextResponse.json({ error: err.message || JSON.stringify(err) || 'Unknown server error during upload' }, { status: 500 });
  }
}