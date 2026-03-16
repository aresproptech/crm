"use client";

import { Plus, Bell, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopbarProps {
  title: string;
  onCreateLead?: () => void;
}

export function Topbar({ title, onCreateLead }: TopbarProps) {
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

        <Button size="sm" className="h-8 gap-1.5 text-xs font-semibold px-3" onClick={onCreateLead}>
          <Plus className="h-3.5 w-3.5" />
          Crear lead
        </Button>

        {/* Profile */}
        <button className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent transition-colors">
          <div className="h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary">AM</span>
          </div>
          <span className="hidden sm:block text-xs font-medium text-foreground">
            Ana M.
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
