import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // For server-side admin

if (!supabaseUrl) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}
if (!supabaseAnonKey) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// Client for client-side browser use (anon key)
// This is the default export if you just import 'supabase' from this module
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side use (service_role key)
// IMPORTANT: This client bypasses RLS and should only be used on the server, never exposed to the client.
let supabaseAdminSingleton: SupabaseClient | null = null;

if (supabaseServiceRoleKey) {
  supabaseAdminSingleton = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
} else {
  // This warning is important for debugging missing service key issues
  console.warn(
    'Supabase service role key (SUPABASE_SERVICE_ROLE_KEY) is not available in the environment. ' +
    'The `supabaseAdmin` client will not be initialized with admin privileges. ' +
    'This is expected in client-side bundles if not tree-shaken, or if the key is not set in the server environment where admin operations are performed.'
  );
}

export const supabaseAdmin = supabaseAdminSingleton;

// Helper function to get the admin client, throws error if not initialized
// Useful in server-side code to ensure the admin client is ready.
export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdminSingleton) {
    throw new Error(
      "Supabase admin client is not initialized. " +
      "Ensure SUPABASE_SERVICE_ROLE_KEY is set in your server environment and the server has been restarted."
    );
  }
  return supabaseAdminSingleton;
}
