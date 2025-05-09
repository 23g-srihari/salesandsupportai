// src/app/api/sales-ai/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseClient'; // Ensure this path is correct

export async function POST(req: NextRequest) {
  let supabase;
  try {
    supabase = getSupabaseAdmin();
    console.log("UPLOAD API: Supabase admin client initialized.");
  } catch (error: any) {
    console.error("UPLOAD API: Failed to initialize Supabase admin client:", error);
    return NextResponse.json({ error: "Server configuration error (Supabase client init)." }, { status: 500 });
  }

  try {
    const { files, uploaded_by } = await req.json();
    console.log("UPLOAD API: Request body parsed. Files count:", files?.length, "Uploaded by:", uploaded_by);

    if (!Array.isArray(files) || files.length === 0) {
      console.warn("UPLOAD API: No files provided or files array is empty.");
      return NextResponse.json({ error: 'No files provided for upload.' }, { status: 400 });
    }

    const BUCKET_NAME = 'drivefiles'; 
    const dbRowsToInsert = []; 

    for (const file of files) {
      // This section reconstructs the logic from your DriveFiles.tsx's handleUpload
      // Ensure file object structure matches what DriveFiles.tsx prepares in 'filesToUpload'
      // Specifically 'name', 'path' (for original_drive_id), 'mime_type', 'size_bytes',
      // and the logic for 'content' which is used to derive 'fileDataForUpload' and 'actualContentType'.
      // For this API route, we expect 'content' to have been handled by the client to prepare 'fileDataForUpload'
      // if we were uploading from this API route.
      // However, based on your DriveFiles.tsx, the 'content' (text or base64) is already in 'file.content'.
      // This API route is currently designed to take that pre-fetched content and upload it.

      let fileDataForUpload: Buffer | string | null = null;
      let actualContentType = file.mime_type;
      let storagePath = null; // Will be set upon successful storage upload
      let uploadError = null; // To store any error during storage upload

      // Sanitize filename for storage path construction
      const safeFileName = (file.name || 'untitled_file').replace(/[^a-zA-Z0-9._-]/g, '_');
      const userPrefix = uploaded_by ? `${uploaded_by.replace(/[^a-zA-Z0-9@._-]/g, '_')}/` : 'unknown_user/';
      const fileNameInBucket = `${userPrefix}${Date.now()}_${safeFileName}`;

      console.log(`UPLOAD API: Processing file: ${file.name}. Target in bucket: ${fileNameInBucket}`);

      try {
        if (!file.content) {
          uploadError = 'File content is missing for storage upload.';
          console.warn(`UPLOAD API: ${uploadError} for file ${file.name}`);
        } else if (file.mime_type === 'application/pdf' && typeof file.content === 'string' && file.content.startsWith('data:application/pdf;base64,')) {
          const base64Data = file.content.replace(/^data:application\/pdf;base64,/, '');
          fileDataForUpload = Buffer.from(base64Data, 'base64');
          actualContentType = 'application/pdf';
          console.log(`UPLOAD API: Prepared PDF data for ${file.name}`);
        } else if ((file.mime_type === 'text/plain' || file.mime_type === 'application/vnd.google-apps.document' || file.mime_type.startsWith('text/')) && typeof file.content === 'string') {
          fileDataForUpload = file.content;
          actualContentType = 'text/plain'; 
          console.log(`UPLOAD API: Prepared text data for ${file.name}`);
        } else {
          uploadError = `Unsupported file type (${file.mime_type}) or unexpected content format for storage upload.`;
          console.warn(`UPLOAD API: ${uploadError} for file ${file.name}`);
        }

        if (!uploadError && fileDataForUpload !== null) {
          console.log(`UPLOAD API: Attempting to upload ${fileNameInBucket} to Supabase Storage.`);
          const { data: storageData, error: storageError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileNameInBucket, fileDataForUpload, {
              contentType: actualContentType,
              upsert: false, 
            });

          if (storageError) {
            console.error('UPLOAD API: Supabase Storage Error:', storageError);
            uploadError = storageError.message || 'Unknown storage error';
          } else if (storageData) {
            storagePath = storageData.path;
            console.log(`UPLOAD API: File uploaded to Storage. Path: ${storagePath}`);
          } else {
            console.error('UPLOAD API: Supabase Storage returned no data and no error.');
            uploadError = 'Storage upload succeeded but returned no path.';
          }
        } else if (!uploadError && fileDataForUpload === null) {
          // This case implies file.content was present but didn't match handled types.
          // uploadError should have been set by the type checks above.
          if(!uploadError) uploadError = 'File content was not in a recognized format for upload.';
          console.warn(`UPLOAD API: ${uploadError} for file ${file.name}`);
        }
      } catch (e: any) {
        console.error(`UPLOAD API: Exception during file storage processing for ${file.name}:`, e);
        uploadError = e.message || 'Exception during storage processing.';
      }
      
      // Prepare row for 'uploaded_files' table
      const rowToInsert = {
        name: file.name || 'untitled_file',
        original_drive_id: file.path || null, // 'path' from client becomes 'original_drive_id'
        storage_bucket: BUCKET_NAME,
        storage_path: storagePath, // Null if storage upload failed
        mime_type: file.mime_type || null,
        size_bytes: file.size_bytes || null,
        uploaded_by: uploaded_by || null,
        status: storagePath ? 'pending_extraction' : 'upload_to_storage_failed', // Initial status
        error_message: uploadError || null,
        // extracted_text is not set here; it's populated by the Edge Function.
        // Ensure all other NOT NULL columns in 'uploaded_files' (without a DEFAULT value) are handled
        // or ensure they allow NULLs if data might not always be present.
      };
      dbRowsToInsert.push(rowToInsert);
    }

    if (dbRowsToInsert.length === 0) {
        console.warn("UPLOAD API: No rows prepared for DB insertion (e.g., all files failed pre-storage processing).");
        return NextResponse.json({ error: 'No files were successfully prepared for database record creation.' }, { status: 400 });
    }
    
    console.log("UPLOAD API: Attempting to insert rows into 'uploaded_files' table:", JSON.stringify(dbRowsToInsert, null, 2));
    
    const { data: insertedDbData, error: dbError } = await supabase
        .from('uploaded_files') // Make sure this table name is 100% correct
        .insert(dbRowsToInsert)
        .select();

    if (dbError) {
      console.error('UPLOAD API: Supabase DB Insert Error into uploaded_files (raw error object):', dbError); 
      
      let errorMessage = 'Database insert error.';
      if (dbError.message) {
        errorMessage = `Database insert error: ${dbError.message}`;
      } else if (dbError.details) {
        errorMessage = `Database insert error details: ${dbError.details}`;
      } else if (dbError.code) {
        errorMessage = `Database insert error code: ${dbError.code}`;
      }
      console.error('UPLOAD API: Constructed error message for client:', errorMessage);

      return NextResponse.json({ 
        error: errorMessage, 
        db_error_code: dbError.code,
        db_error_details: dbError.details,
        db_error_hint: dbError.hint,
        // raw_db_error: JSON.stringify(dbError) // Be cautious sending full error object to client
      }, { status: 500 });
    }
    
    console.log("UPLOAD API: Successfully inserted into 'uploaded_files'. Records count:", insertedDbData?.length);
    // console.log("UPLOAD API: Inserted data:", JSON.stringify(insertedDbData, null, 2));

    // ----- Invoke Edge Function -----
    if (insertedDbData) {
      for (const record of insertedDbData) {
        // Ensure record has a storage_path and the status indicates readiness for extraction
        if (record.storage_path && record.status === 'pending_extraction') { 
          console.log(`UPLOAD API: Invoking salesai-extracted-text for uploaded_files.id: ${record.id}, storage_path: ${record.storage_path}`);
          supabase.functions.invoke('salesai-extracted-text', {
            body: {
              recordId: record.id,
              storagePath: record.storage_path,
              bucketName: record.storage_bucket, // Pass bucket name from the record
              mimeType: record.mime_type     // Pass mime type from the record
            },
          }).then(response => {
            if (response.error) {
              console.error(`UPLOAD API: Error response from invoking salesai-extracted-text for ${record.id}:`, response.error);
            } else {
              console.log(`UPLOAD API: salesai-extracted-text invoked for ${record.id}. Response data from invoke:`, response.data);
            }
          }).catch(invocationError => {
             const e = invocationError instanceof Error ? invocationError : new Error(String(invocationError));
             console.error(`UPLOAD API: Critical error calling salesai-extracted-text for ${record.id}:`, e.message);
          });
        } else {
            console.log(`UPLOAD API: Skipping function invocation for record ${record.id}. storage_path: ${record.storage_path}, status: ${record.status}`);
        }
      }
    } else {
        console.warn("UPLOAD API: insertedDbData is null or empty after DB insert, cannot invoke Edge Functions.");
    }

    return NextResponse.json({ 
        success: true, 
        message: "Upload and initial DB record creation successful. Further processing initiated.", 
        data: insertedDbData 
    });

  } catch (err: any) {
    console.error('UPLOAD API: Overall catch block error:', err);
    let message = 'Unknown server error during upload processing.';
    if (err.message) {
        message = err.message;
    } else if (typeof err === 'string') {
        message = err;
    }
    // Consider logging err.stack for more details on unexpected errors
    // console.error('UPLOAD API: Overall catch block error stack:', err.stack);
    return NextResponse.json({ error: message /*, raw_error: JSON.stringify(err) */ }, { status: 500 });
  }
}
