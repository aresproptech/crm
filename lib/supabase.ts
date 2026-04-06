import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Tipos de base de datos
export type LeadObservation = {
  id: number;
  opportunity_id: number;
  text: string;
  created_by: string;
  created_at: string;
};

export type CrmUser = {
  id: number;
  auth_id: string;
  name: string;
  rol: "Admin" | "Coordinador" | "Manager" | "Comercial";
  user: string | null;
  enabled: boolean;
};