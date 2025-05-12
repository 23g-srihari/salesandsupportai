// File: src/app/api/sales-ai/delete-document/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseClient';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/utils/authOptions"; // Import authOptions from the utility file

const BUCKET_NAME = 'drivefiles'; // Ensure this matches your actual bucket name
// temporary comment

interface RouteParams {
  params: {
    documentId: string;
  };
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { documentId } = params;

  if (!documentId) {
    return NextResponse.json({ success: false, error: 'Invalid document ID provided.' }, { status: 400 });
  }

  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized: Not signed in.' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase admin client not initialized.' }, { status: 500 });
  }

  try {

    // 1. Fetch the document record
    const { data: documentRecord, error: fetchError } = await supabase
      .from('uploaded_files')
      .select('id, uploaded_by, storage_path, name')
      .eq('id', documentId)
      .single();

    if (fetchError) {
      // console.error(`Error fetching document ${documentId} for deletion:`, fetchError);
      if (fetchError.code === 'PGRST116') { // Not found
        return NextResponse.json({ success: false, error: 'Document not found.' }, { status: 404 });
      }
      return NextResponse.json({ success: false, error: 'Failed to fetch document details.' }, { status: 500 });
    }

    if (!documentRecord) {
      return NextResponse.json({ success: false, error: 'Document not found.' }, { status: 404 });
    }

    // 2. Authorization
    if (documentRecord.uploaded_by !== session.user.email) {
      // console.warn(`Unauthorized delete attempt by user ${session.user.email}`);
      return NextResponse.json({ success: false, error: 'Unauthorized: You do not own this document.' }, { status: 403 });
    }

    // 3. Delete associated records from 'analyzed_products'
    const { error: analyzedProductsDeleteError } = await supabase
      .from('analyzed_products')
      .delete()
      .eq('uploaded_file_id', documentId);

    if (analyzedProductsDeleteError) {
      // console.error(`Error deleting associated products for document ${documentId}:`, analyzedProductsDeleteError);
      // Optionally, handle this error more gracefully or make it part of a transaction
    } else {
      // console.log(`Successfully deleted associated products for document ${documentId}`);
    }

    // 4. Delete file from Supabase Storage
    if (documentRecord.storage_path) {
      const { error: storageDeleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([documentRecord.storage_path]);

      if (storageDeleteError) {
        // console.error(`Error deleting file from storage for document ${documentId}:`, storageDeleteError);
        // Log this error, but proceed to delete the DB record.
      } else {
        // console.log(`Successfully deleted file from storage for document ${documentId}`);
      }
    } else {
      // console.log(`No storage_path for document ${documentId}, skipping storage deletion.`);
    }

    // 5. Delete the record from 'uploaded_files' table
    const { error: mainRecordDeleteError } = await supabase
      .from('uploaded_files')
      .delete()
      .eq('id', documentId);

    if (mainRecordDeleteError) {
      // console.error(`Error deleting main record for document ${documentId}:`, mainRecordDeleteError);
      return NextResponse.json({ success: false, error: 'Failed to delete document record from database.' }, { status: 500 });
    }

    // console.log(`Successfully deleted document ${documentId} by user ${session.user.email}`);
    return NextResponse.json({ success: true, message: `Document "${documentRecord.name}" deleted successfully.` });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    // console.error('Critical error in delete-document API:', errorMessage);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

// Ensure there's a newline character after this final brace