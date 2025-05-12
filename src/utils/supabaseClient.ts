// src/utils/supabaseClient.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // For server-side admin

// ADD THIS LOG
console.log("UTILS/SUPABASECLIENT: Initializing. SUPABASE_SERVICE_ROLE_KEY is:", supabaseServiceRoleKey ? "SET" : "NOT SET or undefined");

if (!supabaseUrl) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseAnonKey) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// Client for client-side browser use (anon key)
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side use (service_role key)
let supabaseAdminSingleton: SupabaseClient | null = null;

if (supabaseServiceRoleKey) {
  supabaseAdminSingleton = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
} else {
  console.warn(
    'Supabase service role key (SUPABASE_SERVICE_ROLE_KEY) is not available in the environment. ' +
    'The `supabaseAdmin` client will not be initialized with admin privileges. ' +
    'This is expected in client-side bundles if not tree-shaken, or if the key is not set in the server environment where admin operations are performed.'
  );
}

export const supabaseAdmin = supabaseAdminSingleton;

// Helper function to get the admin client, throws error if not initialized
export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdminSingleton) {
    throw new Error(
      "Supabase admin client is not initialized. " +
      "Ensure SUPABASE_SERVICE_ROLE_KEY is set in your server environment and the server has been restarted."
    );
  }
  return supabaseAdminSingleton;
}