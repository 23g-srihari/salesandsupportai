import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/utils/authOptions"; // Adjust path as needed

export async function GET(req: NextRequest) {
  console.log("SUPPORT-AI DOCS: SUPABASE_SERVICE_ROLE_KEY is:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "NOT SET"); // <-- ADD THIS LINE
  console.log("SUPPORT-AI DOCS: NEXT_PUBLIC_SUPABASE_URL is:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "NOT SET"); // <-- ADD THIS LINE

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ error: "Server configuration error: Supabase credentials missing." }, { status: 500 });
  }
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return NextResponse.json({ error: "Unauthorized: User not authenticated." }, { status: 401 });
  }
  const authenticatedUserIdentifier = session.user.email;


  try {
    // console.log(`[API/documents GET] Fetching documents for user: ${authenticatedUserIdentifier}`);
    const { data, error } = await supabaseAdmin
      .from('support_source_documents')
      .select('id, file_name, mime_type, created_at, processing_status, size_bytes')
      .eq('uploaded_by_user_id', authenticatedUserIdentifier)
      .order('created_at', { ascending: false });

    if (error) {
      // console.error("[API/documents GET] Error fetching documents:", error);
      return NextResponse.json({ error: `Database error: ${error.message}` }, { status: 500 });
    }

    // console.log(`[API/documents GET] Successfully fetched ${data?.length || 0} documents for user: ${authenticatedUserIdentifier}`);
    return NextResponse.json(data || [], { status: 200 });

  } catch (error: any) {
    // console.error("[API/documents GET] Unhandled error:", error);
    return NextResponse.json({ error: `An unexpected error occurred: ${error.message}` }, { status: 500 });
  }
}
