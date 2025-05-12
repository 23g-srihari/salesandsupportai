// File: src/app/api/sales-ai/delete-document/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const responsePayload = {
      success: true,
      message: "Bare minimum API test for delete-document route successful."
    };
    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error in bare minimum test.';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

// Make sure there's a blank line after this final
