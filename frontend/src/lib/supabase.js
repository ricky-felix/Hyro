import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseKey = import.meta.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase environment variables. Check SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in your .env file."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
