import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

function requireUrl(): string {
  const value = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL. Add it to your root .env (see .env.example). Restart Expo after changing .env."
    );
  }
  return value;
}

function requirePublishableKey(): string {
  const value = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!value) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_KEY. Add it to your root .env (see .env.example). Restart Expo after changing .env."
    );
  }
  return value;
}

const supabaseUrl = requireUrl();
/** Publishable key (dashboard may label it “publishable”; older docs call it anon). Safe in the client; RLS enforces access. */
const supabaseKey = requirePublishableKey();

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
