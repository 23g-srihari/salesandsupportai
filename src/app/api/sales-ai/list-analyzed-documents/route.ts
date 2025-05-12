// src/app/api/sales-ai/list-analyzed-documents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/utils/supabaseClient'; // Ensure this path is correct
import { getServerSession } from "next-auth/next"; // Import getServerSession
import { authOptions } from "@/utils/authOptions"; // Import authOptions

export async function GET(req: NextRequest) { // Using GET as we're fetching a list
    const functionName = "list-analyzed-documents-api";
    // console.log(`${functionName}: Received GET request.`);

    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized: User not authenticated." }, { status: 401 });
    }
    const authenticatedUserIdentifier = session.user.email;
    // console.log(`${functionName}: User authenticated: ${authenticatedUserIdentifier}`);

    let supabase;
    try {
        supabase = getSupabaseAdmin();
        if (!supabase) {
            // console.error(`${functionName}: Failed to initialize Supabase admin client.`);
            throw new Error("Failed to initialize Supabase admin client.");
        }
        // console.log(`${functionName}: Supabase admin client initialized successfully.`);

        // Define statuses that indicate a document's products are ready for searching
        const searchableStatuses = [
            'analysis_complete_all_products',
            'analysis_complete_with_errors',
            'analysis_no_products_found',
            'pdf_extraction_skipped'
        ];

        // console.log(`${functionName}: Attempting to query uploaded_files for user ${authenticatedUserIdentifier}.`);
        const { data, error } = await supabase
            .from('uploaded_files') // Ensure this is your table name for uploaded files
            .select('id, name, created_at, status, mime_type')
            .eq('context', 'sales_ai') // Filter for sales_ai context
            .eq('uploaded_by', authenticatedUserIdentifier) // Filter by authenticated user
            .in('status', searchableStatuses)
            .order('created_at', { ascending: false })
            .limit(100); // Adjust limit as needed

        if (error) {
            // console.error(`${functionName} - Supabase query error:`, error);
            return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
        }

        // console.log(`${functionName}: Found ${data?.length || 0} documents for user ${authenticatedUserIdentifier}.`);
        return NextResponse.json({ success: true, documents: data || [] }, { status: 200 });

    } catch (e: any) {
        // console.error(`${functionName} - Caught unexpected error:`, e.message, e.stack);
        return NextResponse.json({ error: e.message || "An unexpected error occurred." }, { status: 500 });
    }
}