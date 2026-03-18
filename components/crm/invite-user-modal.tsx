"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type UserRole = "Admin" | "Comercial" | "Planner" | "Viewer";
export type UserStatus = "Pendiente" | "Activo" | "Inactivo";

export type InviteUserFormData = {
  nombre: string;
  apellido: string;
  email: string;
  rol: UserRole | "";
  estado: UserStatus | "";
};

const EMPTY: InviteUserFormData = {
  nombre: "",
  apellido: "",
  email: "",
  rol: "",
  estado: "",
};

function isValidEmail(email: string) {
  // Good-enough UI validation (backend should re-validate later)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function InviteUserModal({
  open,
  onOpenChange,
  existingEmails,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingEmails: string[];
  onSubmit: (data: Omit<InviteUserFormData, "rol" | "estado"> & { rol: UserRole; estado: UserStatus }) => void;
}) {
  const [form, setForm] = React.useState<InviteUserFormData>(EMPTY);
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setForm(EMPTY);
      setTouched(false);
    }
  }, [open]);

  function set<K extends keyof InviteUserFormData>(key: K, value: InviteUserFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const emailNorm = form.email.trim().toLowerCase();
  const duplicateEmail = existingEmails.map((e) => e.toLowerCase()).includes(emailNorm);

  const requiredOk =
    form.nombre.trim() &&
    form.apellido.trim() &&
    isValidEmail(form.email) &&
    Boolean(form.rol) &&
    Boolean(form.estado) &&
    !duplicateEmail;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!requiredOk) return;

    onSubmit({
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      email: emailNorm,
      rol: form.rol as UserRole,
      estado: form.estado as UserStatus,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Invitar usuario</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Crea un usuario en el CRM (modo local). Más adelante se podrá conectar con autenticación.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-1 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.nombre}
                onChange={(e) => set("nombre", e.target.value)}
                className="h-8 text-sm"
                placeholder="Ej. Ana"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">
                Apellido <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.apellido}
                onChange={(e) => set("apellido", e.target.value)}
                className="h-8 text-sm"
                placeholder="Ej. Martínez"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="h-8 text-sm"
              placeholder="ana@empresa.com"
              inputMode="email"
              type="email"
              required
              onBlur={() => setTouched(true)}
            />
            {touched && form.email.trim() && !isValidEmail(form.email) && (
              <span className="text-[11px] text-destructive">
                Introduce un email válido.
              </span>
            )}
            {touched && duplicateEmail && (
              <span className="text-[11px] text-destructive">
                Ya existe un usuario con ese email.
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">
                Rol <span className="text-destructive">*</span>
              </Label>
              <Select value={form.rol} onValueChange={(v) => set("rol", v as any)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Comercial">Comercial</SelectItem>
                  <SelectItem value="Planner">Planner</SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">
                Estado <span className="text-destructive">*</span>
              </Label>
              <Select value={form.estado} onValueChange={(v) => set("estado", v as any)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-2 flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={!requiredOk}>
              Crear usuario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

