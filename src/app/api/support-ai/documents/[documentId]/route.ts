import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Adjust path as needed

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface RouteParams {
  params: {
    documentId: string;
  };
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { documentId } = params;

  if (!documentId) {
    return NextResponse.json({ error: "Document ID is required." }, { status: 400 });
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ error: "Server configuration error: Supabase credentials missing." }, { status: 500 });
  }
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized: User not authenticated." }, { status: 401 });
  }
  const authenticatedUserIdentifier = session.user.email;

  // console.log(`[API/documents DELETE] Attempting to delete document ID: ${documentId} for user: ${authenticatedUserIdentifier}`);

  try {
    // 1. Fetch the document to verify ownership and get storage details
    const { data: document, error: fetchError } = await supabaseAdmin
      .from('support_source_documents')
      .select('id, uploaded_by_user_id, storage_path, storage_bucket_name')
      .eq('id', documentId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') { // PostgREST error for "Fetched result contains 0 rows" 
        return NextResponse.json({ error: "Document not found." }, { status: 404 });
      }
      // console.error(`[API/documents DELETE] Error fetching document ${documentId}:`, fetchError);
      return NextResponse.json({ error: `Database error fetching document: ${fetchError.message}` }, { status: 500 });
    }

    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    // 2. Verify ownership
    if (document.uploaded_by_user_id !== authenticatedUserIdentifier) {
      // console.warn(`[API/documents DELETE] Unauthorized attempt by ${authenticatedUserIdentifier} to delete document ${documentId} owned by ${document.uploaded_by_user_id}`);
      return NextResponse.json({ error: "Forbidden: You do not own this document." }, { status: 403 });
    }

    // 3. Delete associated chunks from support_document_chunks
    // If ON DELETE CASCADE is set on the foreign key in support_document_chunks, this step might be optional
    // as deleting the parent in support_source_documents would cascade. 
    // However, explicit deletion can be clearer or necessary if cascade is not set.
    const { error: chunkDeleteError } = await supabaseAdmin
        .from('support_document_chunks')
        .delete()
        .eq('source_document_id', documentId);

    if (chunkDeleteError) {
        // console.error(`[API/documents DELETE] Error deleting chunks for document ${documentId}:`, chunkDeleteError);
        // Decide if this is a hard stop or if you try to delete the main doc & file anyway.
        // For now, let's treat it as a failure to ensure data integrity before file deletion.
        return NextResponse.json({ error: `Failed to delete associated document chunks: ${chunkDeleteError.message}` }, { status: 500 });
    }
    // console.log(`[API/documents DELETE] Successfully deleted chunks for document ${documentId}`);

    // 4. Delete the document record from support_source_documents
    const { error: mainDocDeleteError } = await supabaseAdmin
      .from('support_source_documents')
      .delete()
      .eq('id', documentId);

    if (mainDocDeleteError) {
      // console.error(`[API/documents DELETE] Error deleting main document record ${documentId}:`, mainDocDeleteError);
      return NextResponse.json({ error: `Failed to delete document record: ${mainDocDeleteError.message}` }, { status: 500 });
    }
    // console.log(`[API/documents DELETE] Successfully deleted main document record ${documentId}`);

    // 5. Delete the file from Supabase Storage
    if (document.storage_path && document.storage_bucket_name) {
      // console.log(`[API/documents DELETE] Deleting from storage: bucket=${document.storage_bucket_name}, path=${document.storage_path}`);
      const { error: storageDeleteError } = await supabaseAdmin.storage
        .from(document.storage_bucket_name)
        .remove([document.storage_path]);

      if (storageDeleteError) {
        // console.error(`[API/documents DELETE] Error deleting file from storage for document ${documentId}:`, storageDeleteError);
        // At this point, DB records are deleted. This is an orphaned file scenario.
        // Log this error carefully. You might return a success to the user but flag this internally.
        return NextResponse.json({ 
            warning: "Document record deleted from database, but failed to delete file from storage. Please check server logs.",
            error: `Storage deletion failed: ${storageDeleteError.message}` 
        }, { status: 207 }); // 207 Multi-Status, as part of the operation succeeded
      }
      // console.log(`[API/documents DELETE] Successfully deleted file from storage for document ${documentId}`);
    } else {
      // console.warn(`[API/documents DELETE] Document ${documentId} had no storage_path or storage_bucket_name. Skipping storage deletion.`);
    }

    return NextResponse.json({ message: "Document and associated data deleted successfully." }, { status: 200 });

  } catch (error: any) {
    // console.error(`[API/documents DELETE] Unhandled error for document ${documentId}:`, error);
    return NextResponse.json({ error: `An unexpected error occurred: ${error.message}` }, { status: 500 });
  }
}
