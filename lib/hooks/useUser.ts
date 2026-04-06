"use client";

import { useEffect, useState } from "react";
import { supabase, type CrmUser } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export type UserWithRole = {
  authUser: User;
  crmUser: CrmUser;
};

export function useUser() {
  const [userWithRole, setUserWithRole] = useState<UserWithRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      // Obtenemos la sesión actual
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setLoading(false);
        return;
      }

      // Buscamos el usuario en la tabla users por auth_id
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", session.user.id)
        .single();

      if (error || !data) {
        console.error("Error cargando usuario CRM:", error);
        setLoading(false);
        return;
      }

      setUserWithRole({
        authUser: session.user,
        crmUser: data as CrmUser,
      });

      setLoading(false);
    }

    loadUser();

    // Escuchamos cambios de sesión
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!session) {
          setUserWithRole(null);
          return;
        }

        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("auth_id", session.user.id)
          .single();

        if (data) {
          setUserWithRole({
            authUser: session.user,
            crmUser: data as CrmUser,
          });
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return { userWithRole, loading };
}

// Helper para saber si un usuario puede ver todos los leads
export function canViewAllLeads(crmUser: CrmUser): boolean {
  if (
    crmUser.rol === "Admin" ||
    crmUser.rol === "Coordinador" ||
    crmUser.rol === "Manager"
  ) {
    return true;
  }
  return false;
}

// Helper para saber si un usuario puede editar leads
export function canEditLeads(crmUser: CrmUser): boolean {
  return crmUser.rol === "Admin" || crmUser.rol === "Comercial";
}