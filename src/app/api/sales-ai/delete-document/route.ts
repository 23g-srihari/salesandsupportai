// File: src/app/api/sales-ai/delete-document/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseClient';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Adjust path if your authOptions is elsewhere

const BUCKET_NAME = 'user_document_uploads'; // Ensure this matches your actual bucket name

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized: Not signed in.' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase admin client not initialized.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { documentId } = body;

    if (!documentId || typeof documentId !== 'string') {
      return NextResponse.json({ success: false, error: 'Invalid document ID provided.' }, { status: 400 });
    }

    // 1. Fetch the document record to get storage_path and verify ownership
    const { data: documentRecord, error: fetchError } = await supabase
      .from('uploaded_files')
      .select('id, uploaded_by, storage_path, name')
      .eq('id', documentId)
      .single();

    if (fetchError) {
      console.error(`Error fetching document ${documentId} for deletion:`, fetchError);
      if (fetchError.code === 'PGRST116') { // Not found
          return NextResponse.json({ success: false, error: 'Document not found.' }, { status: 404 });
      }
      return NextResponse.json({ success: false, error: 'Failed to fetch document details.' }, { status: 500 });
    }

    if (!documentRecord) {
      return NextResponse.json({ success: false, error: 'Document not found.' }, { status: 404 });
    }

    // 2. Authorization: Check if the current user owns the document
    //    TODO: Implement admin override if needed
    if (documentRecord.uploaded_by !== session.user.email) {
      console.warn(`Unauthorized delete attempt for document ${documentId} by user ${session.user.email}. Owner: ${documentRecord.uploaded_by}`);
      return NextResponse.json({ success: false, error: 'Unauthorized: You do not own this document.' }, { status: 403 });
    }

    // 3. Delete associated records from 'analyzed_products'
    const { error: analyzedProductsDeleteError } = await supabase
      .from('analyzed_products')
      .delete()
      .eq('uploaded_file_id', documentId);

    if (analyzedProductsDeleteError) {
      console.error(`Error deleting associated analyzed products for document ${documentId}:`, analyzedProductsDeleteError);
      // Decide if this is a hard stop or if you proceed to delete the main file anyway
      // For now, we'll log and proceed, but you might want to make this transactional or halt.
    } else {
      console.log(`Successfully deleted associated analyzed products for document ${documentId}`);
    }

    // 4. Delete file from Supabase Storage (if storage_path exists)
    if (documentRecord.storage_path) {
      const { error: storageDeleteError } = await supabase.storage
        .from(BUCKET_NAME) // Use the constant
        .remove([documentRecord.storage_path]); // remove expects an array of paths

      if (storageDeleteError) {
        console.error(`Error deleting file ${documentRecord.storage_path} from storage for document ${documentId}:`, storageDeleteError);
        // Log this error, but proceed to delete the DB record as the primary source of truth.
        // Orphaned storage files might need a separate cleanup job.
      } else {
        console.log(`Successfully deleted file ${documentRecord.storage_path} from storage for document ${documentId}`);
      }
    } else {
        console.log(`No storage_path for document ${documentId}, skipping storage deletion.`);
    }

    // 5. Delete the record from 'uploaded_files' table
    const { error: mainRecordDeleteError } = await supabase
      .from('uploaded_files')
      .delete()
      .eq('id', documentId);

    if (mainRecordDeleteError) {
      console.error(`Error deleting main record for document ${documentId}:`, mainRecordDeleteError);
      return NextResponse.json({ success: false, error: 'Failed to delete document record from database.' }, { status: 500 });
    }

    console.log(`Successfully deleted document ${documentId} (name: ${documentRecord.name}) by user ${session.user.email}`);
    return NextResponse.json({ success: true, message: `Document "${documentRecord.name}" deleted successfully.` });

  } catch (error: any) {
    console.error('Critical error in delete-document API:', error);
    return NextResponse.json({ success: false, error: error.message || 'An unexpected error occurred.' }, { status: 500 });
  }
}
