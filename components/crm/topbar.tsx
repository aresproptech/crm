"use client";

import { Plus, Bell, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { LogoutButton } from "@/components/crm/logout-button";
import { useUser } from "@/lib/hooks/useUser";

interface TopbarProps {
  title: string;
  onCreateLead?: () => void;
}

export function Topbar({ title, onCreateLead }: TopbarProps) {
  const { userWithRole } = useUser();

  // Iniciales del usuario
  const initials = userWithRole?.crmUser.name
    ? userWithRole.crmUser.name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "?";

  const displayName = userWithRole?.crmUser.name
    ? userWithRole.crmUser.name.split(" ")[0]
    : "Usuario";

  return (
    <header className="fixed top-0 right-0 left-56 z-10 flex h-14 items-center gap-4 border-b border-border bg-card px-6">
      {/* Page title */}
      <h1 className="text-sm font-semibold text-foreground tracking-tight">
        {title}
      </h1>

      {/* Divider */}
      <div className="h-4 w-px bg-border" />

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Notificaciones"
              className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              type="button"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-2">
            <div className="px-2 py-2 text-xs text-muted-foreground">
              No hay notificaciones
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs font-semibold px-3"
          onClick={onCreateLead}
        >
          <Plus className="h-3.5 w-3.5" />
          Crear lead
        </Button>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent transition-colors">
              <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary">
                  {initials}
                </span>
              </div>
              <span className="hidden sm:block text-xs font-medium text-foreground">
                {displayName}
              </span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 p-1">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium text-foreground">
                {userWithRole?.crmUser.name ?? "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {userWithRole?.crmUser.rol ?? "—"}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <LogoutButton />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}