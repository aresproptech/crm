"use client";

import { useMemo, useState } from "react";
import { Topbar } from "@/components/crm/topbar";
import { UserCog, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  InviteUserModal,
  type UserRole,
  type UserStatus,
} from "@/components/crm/invite-user-modal";
import { cn } from "@/lib/utils";

type CrmUser = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: UserRole;
  estado: UserStatus;
  initials: string;
};

function initials(nombre: string, apellido: string) {
  const a = (nombre.trim()[0] ?? "").toUpperCase();
  const b = (apellido.trim()[0] ?? "").toUpperCase();
  return a + b || "U";
}

const STATUS_BADGE: Record<UserStatus, { className: string }> = {
  Pendiente: { className: "bg-amber-50 text-amber-700 border-amber-200" },
  Activo: { className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  Inactivo: { className: "bg-muted text-muted-foreground border-border" },
};

const ROLE_BADGE: Record<UserRole, { className: string }> = {
  Admin: { className: "bg-primary/10 text-primary border-primary/20" },
  Comercial: { className: "bg-blue-50 text-blue-700 border-blue-200" },
  Planner: { className: "bg-violet-50 text-violet-700 border-violet-200" },
  Viewer: { className: "bg-muted text-muted-foreground border-border" },
};

export default function UsuariosPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [users, setUsers] = useState<CrmUser[]>([
    {
      id: "u1",
      nombre: "Ana",
      apellido: "Martínez",
      email: "ana@aresproptech.com",
      rol: "Admin",
      estado: "Activo",
      initials: "AM",
    },
  ]);

  const emails = useMemo(() => users.map((u) => u.email), [users]);

  return (
    <>
      <Topbar title="Usuarios" />
      <main className="flex flex-col flex-1 overflow-hidden mt-14 min-h-0">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6 py-2.5">
          <span className="text-xs text-muted-foreground">
            Equipo y permisos de acceso
          </span>
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs font-semibold"
            onClick={() => setModalOpen(true)}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Invitar usuario
          </Button>
        </div>

        {users.length <= 1 ? (
          <div className="flex flex-1 items-center justify-center">
            <Empty>
              <EmptyContent>
                <EmptyHeader>
                  <EmptyMedia>
                    <UserCog className="h-8 w-8 text-muted-foreground/40" />
                  </EmptyMedia>
                  <EmptyTitle>Sin usuarios adicionales</EmptyTitle>
                  <EmptyDescription>
                    Invita a los agentes de tu equipo para colaborar en el
                    pipeline.
                  </EmptyDescription>
                </EmptyHeader>
              </EmptyContent>
            </Empty>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                    Usuario
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                    Email
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                    Rol
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr
                    key={u.id}
                    className={cn(
                      "border-b border-border transition-colors hover:bg-accent/60",
                      i % 2 === 0 ? "bg-card" : "bg-background"
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary uppercase">
                          {u.initials}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground leading-tight">
                            {u.nombre} {u.apellido}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                          ROLE_BADGE[u.rol].className
                        )}
                      >
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                          STATUS_BADGE[u.estado].className
                        )}
                      >
                        {u.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <InviteUserModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        existingEmails={emails}
        onSubmit={(data) => {
          const newUser: CrmUser = {
            id: crypto.randomUUID(),
            nombre: data.nombre,
            apellido: data.apellido,
            email: data.email,
            rol: data.rol,
            estado: data.estado,
            initials: initials(data.nombre, data.apellido),
          };
          setUsers((prev) => [newUser, ...prev]);
        }}
      />
    </>
  );
}