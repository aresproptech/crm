"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AGENT_OPTIONS,
  PHASE_OPTIONS,
  SOURCE_OPTIONS,
} from "@/lib/crm-data";
import { LocateFixed, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NewLeadFormData {
  ownerName: string;
  address: string;
  distrito: string;
  municipio: string;
  provincia: string;
  cp: string;
  valor: string;
  phone: string;
  source: string;
  medio: string;
  enVenta: string;
  status: string;
  phase: string;
  fechaNoticia: string;
  fechaContacto: string;
  fechaValoracion: string;
  hora: string;
  owner: string;
  planner: string;
  notes: string;
}

const EMPTY_FORM: NewLeadFormData = {
  ownerName: "",
  address: "",
  distrito: "",
  municipio: "",
  provincia: "",
  cp: "",
  valor: "",
  phone: "",
  source: "",
  medio: "",
  enVenta: "No Sabe",
  status: "",
  phase: "",
  fechaNoticia: "",
  fechaContacto: "",
  fechaValoracion: "",
  hora: "",
  owner: "",
  planner: "",
  notes: "",
};

const NEW_LEAD_PHASE_OPTIONS = PHASE_OPTIONS.filter((opt) =>
  ["Noticia", "Concertada", "Valorada", "Encargo"].includes(opt.label)
);

const NEW_LEAD_STATUS_OPTIONS = [
  { value: "Identificada", label: "Identificada" },
  { value: "Cualificada", label: "Cualificada" },
  { value: "Caliente", label: "Caliente" },
  { value: "Desestimada", label: "Desestimada" },
];

function formatEuroValue(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  const formatted = new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 0,
  }).format(Number(digits));

  return `${formatted} €`;
}

interface PostalCodeResult {
  cp: string;
  municipio: string;
  provincia: string;
  distrito: string | null;
}

async function fetchPostalCode(cp: string): Promise<PostalCodeResult | null> {
  try {
    const res = await fetch(`/api/postal-code/${cp}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

interface NewLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: NewLeadFormData) => void;
}

export function NewLeadModal({
  open,
  onOpenChange,
  onSubmit,
}: NewLeadModalProps) {
  const [form, setForm] = useState<NewLeadFormData>(EMPTY_FORM);
  const [cpLoading, setCpLoading] = useState(false);
  const [cpAutoFilled, setCpAutoFilled] = useState(false);

  function handleField(field: keyof NewLeadFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleValorChange(value: string) {
    handleField("valor", formatEuroValue(value));
  }

  const handleCpChange = useCallback(async (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 5);
    handleField("cp", digits);
    setCpAutoFilled(false);

    if (digits.length !== 5) return;

    setCpLoading(true);
    try {
      const result = await fetchPostalCode(digits);
      if (result) {
        setForm((prev) => ({
          ...prev,
          municipio: result.municipio,
          provincia: result.provincia,
          distrito: result.distrito || prev.distrito,
        }));
        setCpAutoFilled(true);
      }
    } finally {
      setCpLoading(false);
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit?.(form);
    setForm(EMPTY_FORM);
    setCpAutoFilled(false);
    onOpenChange(false);
  }

  function handleCancel() {
    setForm(EMPTY_FORM);
    setCpAutoFilled(false);
    onOpenChange(false);
  }

  const isValid =
    form.ownerName.trim() &&
    form.address.trim() &&
    form.phone.trim() &&
    form.source &&
    form.status &&
    form.phase;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Nuevo lead
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Introduce los datos principales del nuevo lead.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-1 flex flex-col gap-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ownerName" className="text-xs font-medium">
                Propietario <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ownerName"
                placeholder="Ej. Carlos Sánchez Ruiz"
                value={form.ownerName}
                onChange={(e) => handleField("ownerName", e.target.value)}
                className="h-8 text-sm"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone" className="text-xs font-medium">
                Teléfono <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Ej. +34 612 345 678"
                value={form.phone}
                onChange={(e) => handleField("phone", e.target.value)}
                className="h-8 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label htmlFor="address" className="text-xs font-medium">
                Domicilio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="address"
                placeholder="Ej. C/ Serrano 12"
                value={form.address}
                onChange={(e) => handleField("address", e.target.value)}
                className="h-8 text-sm"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cp" className="text-xs font-medium">
                CP
              </Label>
              <div className="relative">
                <Input
                  id="cp"
                  placeholder="5 dígitos"
                  value={form.cp}
                  onChange={(e) => void handleCpChange(e.target.value)}
                  className="h-8 text-sm font-mono pr-8"
                  maxLength={5}
                  inputMode="numeric"
                  disabled={cpLoading}
                />
                {cpLoading && (
                  <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-primary" />
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="municipio"
                className="text-xs font-medium flex items-center gap-1.5"
              >
                Municipio
                {cpAutoFilled && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary leading-none">
                    <LocateFixed className="h-2.5 w-2.5" />
                    auto
                  </span>
                )}
              </Label>
              <Input
                id="municipio"
                value={form.municipio}
                onChange={(e) => handleField("municipio", e.target.value)}
                className={cn(
                  "h-8 text-sm",
                  cpAutoFilled && "border-primary/40 bg-primary/5"
                )}
                placeholder="—"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="distrito"
                className="text-xs font-medium flex items-center gap-1.5"
              >
                Distrito
                {cpAutoFilled && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary leading-none">
                    <LocateFixed className="h-2.5 w-2.5" />
                    auto
                  </span>
                )}
              </Label>
              <Input
                id="distrito"
                value={form.distrito}
                onChange={(e) => handleField("distrito", e.target.value)}
                className={cn(
                  "h-8 text-sm",
                  cpAutoFilled && "border-primary/40 bg-primary/5"
                )}
                placeholder="—"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="provincia"
                className="text-xs font-medium flex items-center gap-1.5"
              >
                Provincia
                {cpAutoFilled && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary leading-none">
                    <LocateFixed className="h-2.5 w-2.5" />
                    auto
                  </span>
                )}
              </Label>
              <Input
                id="provincia"
                value={form.provincia}
                onChange={(e) => handleField("provincia", e.target.value)}
                className={cn(
                  "h-8 text-sm",
                  cpAutoFilled && "border-primary/40 bg-primary/5"
                )}
                placeholder="—"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="valor" className="text-xs font-medium">
                Valor
              </Label>
              <Input
                id="valor"
                placeholder="Ej. 450.000 €"
                value={form.valor}
                onChange={(e) => handleValorChange(e.target.value)}
                className="h-8 text-sm"
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source" className="text-xs font-medium">
                Origen <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.source}
                onValueChange={(v) => handleField("source", v)}
              >
                <SelectTrigger id="source" className="h-8 text-sm">
                  <SelectValue placeholder="Seleccionar origen" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phase" className="text-xs font-medium">
                Fase <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.phase}
                onValueChange={(v) => handleField("phase", v)}
              >
                <SelectTrigger id="phase" className="h-8 text-sm">
                  <SelectValue placeholder="Seleccionar fase" />
                </SelectTrigger>
                <SelectContent>
                  {NEW_LEAD_PHASE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status" className="text-xs font-medium">
                Estado <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.status}
                onValueChange={(v) => handleField("status", v)}
              >
                <SelectTrigger id="status" className="h-8 text-sm">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {NEW_LEAD_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fechaNoticia" className="text-xs font-medium">
                Fecha noticia
              </Label>
              <Input
                id="fechaNoticia"
                type="date"
                value={form.fechaNoticia}
                onChange={(e) => handleField("fechaNoticia", e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fechaContacto" className="text-xs font-medium">
                Fecha contacto
              </Label>
              <Input
                id="fechaContacto"
                type="date"
                value={form.fechaContacto}
                onChange={(e) => handleField("fechaContacto", e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="fechaValoracion"
                className="text-xs font-medium"
              >
                Fecha valoración
              </Label>
              <Input
                id="fechaValoracion"
                type="date"
                value={form.fechaValoracion}
                onChange={(e) =>
                  handleField("fechaValoracion", e.target.value)
                }
                className="h-8 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hora" className="text-xs font-medium">
                Hora
              </Label>
              <Input
                id="hora"
                type="time"
                value={form.hora}
                onChange={(e) => handleField("hora", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="owner" className="text-xs font-medium">
                Owner
              </Label>
              <Select
                value={form.owner}
                onValueChange={(v) => handleField("owner", v)}
              >
                <SelectTrigger id="owner" className="h-8 text-sm">
                  <SelectValue placeholder="Seleccionar agente" />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_OPTIONS.map((agent) => (
                    <SelectItem key={agent} value={agent}>
                      {agent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="planner" className="text-xs font-medium">
                Planner
              </Label>
              <Select
                value={form.planner}
                onValueChange={(v) => handleField("planner", v)}
              >
                <SelectTrigger id="planner" className="h-8 text-sm">
                  <SelectValue placeholder="Seleccionar planner" />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_OPTIONS.map((agent) => (
                    <SelectItem key={agent} value={agent}>
                      {agent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes" className="text-xs font-medium">
              Observaciones iniciales
            </Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => handleField("notes", e.target.value)}
              className="min-h-[72px] text-sm resize-none"
              placeholder="Notas u observaciones iniciales sobre el lead..."
            />
          </div>

          <DialogFooter className="mt-1 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={!isValid}>
              Crear lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}