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

function requireKey(): string {
  const value = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!value) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_KEY. Add it to your root .env (see .env.example). Restart Expo after changing .env."
    );
  }
  return value;
}

const supabaseUrl = requireUrl();
const supabaseKey = requireKey();

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
