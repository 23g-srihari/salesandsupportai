// src/app/api/support-ai/upload-document/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseClient'; // Assuming your admin client utility
import { v4 as uuidv4 } from 'uuid'; // For generating unique filenames or IDs if needed

// Ensure you have the necessary types from next-auth if you need user session
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route" // Please verify this path is correct

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase client not initialized.' }, { status: 500 });
  }

  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) { // Using email as the identifier
    return NextResponse.json({ error: 'Unauthorized: User not authenticated.' }, { status: 401 });
  }
  const authenticatedUserIdentifier = session.user.email;

  try {
    const body = await req.json();
    const {
      fileName, // e.g., "my_document.pdf"
      mimeType, // e.g., "application/pdf"
      content,  // base64 string for PDF/text, or null for images/other if client sends only metadata
      googleDriveFileId, // Optional: if from Google Drive
      googleDriveUrl,    // Optional: if from Google Drive
      sizeBytes          // Optional: from client
    } = body;

    if (!fileName || !mimeType) {
      return NextResponse.json({ error: 'Missing fileName or mimeType.' }, { status: 400 });
    }

    if (!content && mimeType !== 'image/jpeg' && mimeType !== 'image/png') {
        // For non-image types that we expect to process, content is usually required
        // Or, if content is null, the Edge Function will need to fetch it from googleDriveUrl
        // console.warn(`Content not provided for ${fileName} of type ${mimeType}. Edge function might need to fetch it.`);
    }

    const BUCKET_NAME = 'supportchatattachments';
    // Sanitize filename and create a unique path using the authenticated user identifier
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const userPrefixForPath = authenticatedUserIdentifier.replace(/[^a-zA-Z0-9@._-]/g, '_');
    const uniquePrefix = `${userPrefixForPath}/${Date.now()}`;
    const storagePath = `${uniquePrefix}_${sanitizedFileName}`;

    let uploadError = null;
    let publicUrl = null;

    if (content) {
        let fileDataForUpload: Buffer | string;
        let actualContentType = mimeType;

        if (mimeType === 'application/pdf' && content.startsWith('data:application/pdf;base64,')) {
            const base64Data = content.replace(/^data:application\/pdf;base64,/, '');
            fileDataForUpload = Buffer.from(base64Data, 'base64');
        } else if (mimeType.startsWith('text/') && typeof content === 'string') {
            fileDataForUpload = content;
        } else if (mimeType.startsWith('image/') && content.startsWith('data:image')) {
             // e.g. data:image/png;base64,iVBORw0KGgo...
            const base64Data = content.split(',')[1];
            fileDataForUpload = Buffer.from(base64Data, 'base64');
        }
        else {
            // If content is provided but not in expected format for direct upload here for these types
            // console.warn(`Content for ${fileName} (${mimeType}) is present but not in a recognized direct-upload format. It will be stored as is or requires different handling.`);
            // For simplicity, let's assume if content is there for other types, it's raw string or needs specific handling
            // This part might need refinement based on what client sends for unhandled types with content
             fileDataForUpload = content; // Could be problematic if not string/Buffer
        }

        if (fileDataForUpload) {
            const { data: storageUploadData, error: storageError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(storagePath, fileDataForUpload, {
                    contentType: actualContentType,
                    upsert: false, // true if you want to overwrite if path exists
                });

            if (storageError) {
                // console.error('Supabase Storage Error:', storageError);
                uploadError = storageError.message;
            } else if (storageUploadData) {
                // console.log(`File uploaded to Storage: ${storageUploadData.path}`);
                // Get public URL if needed, though usually not required for backend processing
                // const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
                // publicUrl = urlData?.publicUrl;
            }
        } else {
            uploadError = "File content was recognized but could not be prepared for upload."
        }

    } else if (!googleDriveUrl && (mimeType.startsWith('application/') || mimeType.startsWith('text/'))) {
        // If no content AND no Drive URL for processable types, it's an issue for the Edge Function
        return NextResponse.json({ error: `Content or Google Drive URL is required for ${mimeType} to be processed.` }, { status: 400 });
    }
    // If content is null (e.g., for images where client doesn't send base64, or for docs to be fetched by Edge Fn from Drive URL)
    // we proceed to DB insert, and Edge Function will handle fetching if necessary.

    if (uploadError) {
        return NextResponse.json({ error: `Storage upload failed: ${uploadError}` }, { status: 500 });
    }

    // Insert into support_source_documents
    const { data: dbData, error: dbError } = await supabase
      .from('support_source_documents')
      .insert({
        file_name: fileName,
        mime_type: mimeType,
        size_bytes: sizeBytes || null, // Get from client or after upload if possible
        storage_bucket_name: BUCKET_NAME,
        storage_path: storagePath, // This is key for the Edge Function trigger/lookup
        uploaded_by_user_id: authenticatedUserIdentifier, // Set by the server from authenticated session
        processing_status: 'pending', // Edge function will update this
        // summary: null, // Edge function might populate this
        original_drive_id: googleDriveFileId || null, // Store if available
        // You might want to add the googleDriveUrl here if the Edge Function needs to fetch content
      })
      .select()
      .single();

    if (dbError) {
      // console.error('Supabase DB Insert Error:', dbError);
      // If storage upload happened, consider cleanup or marking as error
      return NextResponse.json({ error: `Database insert failed: ${dbError.message}` }, { status: 500 });
    }

    if (!dbData) {
        return NextResponse.json({ error: 'Failed to create document record in database.' }, { status: 500 });
    }

    // console.log('Document record created:', dbData.id);

    // Manually invoke the 'extract-text-from-support-pdf' function
    // This mirrors how sales-ai invokes its first processing function.
    // console.log(`[API] Invoking 'extract-text-from-support-pdf' for doc ID: ${dbData.id}`);
    const { data: functionResponse, error: functionError } = await supabase.functions.invoke('extract-text-from-support-pdf', {
        body: {
            sourceDocumentId: dbData.id, // Pass the ID of the record in support_source_documents
            storagePath: storagePath,
            bucketName: BUCKET_NAME,
            mimeType: mimeType, // The mimeType known at the time of upload
            // Pass googleDriveFileId and googleDriveUrl if the function might need them and content wasn't fetched by client
            // googleDriveFileId: googleDriveFileId, 
            // googleDriveUrl: googleDriveUrl
        },
    });

    if (functionError) {
        // console.error(`[API] Error invoking 'extract-text-from-support-pdf' function:`, functionError);
        // Even if function invocation fails, the document is uploaded. 
        // The function itself should handle its own status updates if it starts.
        // We might want to update the local record if invocation itself is an immediate error.
        // For now, return success for upload, but with a warning about processing trigger.
        return NextResponse.json({
            success: true, // Upload itself was successful
            warning: 'Document uploaded, but initial processing trigger failed.',
            message: `Document uploaded. Trigger error: ${functionError.message}`,
            documentId: dbData.id,
            filePath: storagePath,
        }, { status: 202 }); // 202 Accepted, but with issues
    }

    // console.log(`[API] 'extract-text-from-support-pdf' function invoked. Response:`, functionResponse);

    return NextResponse.json({
      success: true,
      message: 'Document uploaded and initial processing invoked successfully.',
      documentId: dbData.id,
      filePath: storagePath,
      functionResponseStatus: functionResponse?.status // Pass back function's immediate response status if any
    }, { status: 201 }); // 201 Created

  } catch (error: any) {
    // console.error('Overall error in /api/support-ai/upload-document:', error);
    return NextResponse.json({ error: `An unexpected error occurred: ${error.message}` }, { status: 500 });
  }
}