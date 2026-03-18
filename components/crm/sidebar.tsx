"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Settings,
  Building2,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: Users },
  { label: "Usuarios", href: "/usuarios", icon: UserCog },
  { label: "Ajustes", href: "/ajustes", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-56 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 px-5 border-b border-sidebar-border">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <Building2 className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
          PropCRM
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs font-semibold text-primary">AM</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-sidebar-foreground">
              Ana Martínez
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/50">
              Agente
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
