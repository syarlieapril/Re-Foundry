
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://cskkecilyuzehqntfkoi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_cyEFFF1sINmgROZ7Ci0t7A_4tlJzmHk";

window.supabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

export const supabase = window.supabaseClient;
