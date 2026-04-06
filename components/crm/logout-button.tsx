"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      onClick={() => void handleLogout()}
    >
      <LogOut className="h-3.5 w-3.5" />
      Cerrar sesión
    </Button>
  );
}