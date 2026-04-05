import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Tipos de base de datos — se irán expandiendo por bloque
export type LeadObservation = {
  id: number;
  opportunity_id: number;
  text: string;
  created_by: string;
  created_at: string;
};