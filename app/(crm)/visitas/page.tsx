"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/crm/topbar";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/lib/hooks/useUser";
import { Check, Copy, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const HISTORY_PREFIX = "[HISTORIAL]";

type Visita = {
  id: number;
  opportunity_id: number | null;
  estado: string | null;
  dominio: string | null;
  planner: string | null;
  owner: string | null;
  fecha_visita: string | null;
  hora: string | null;
  buyer: string | null;
  nombre_apellido: string | null;
  telefono: string | null;
  dni: string | null;
  vende: boolean | null;
  observaciones_visita: string | null;
  created_by: string;
  created_at: string;
};

type InmuebleOption = {
  id: number;
  label: string;
  propietario: string | null;
  domicilio: string | null;
  owner: string | null;
  planner: string | null;
  estado: string | null;
  dominio: string | null;
  telefono: string | null;
};

type VisitaForm = {
  opportunity_id: string;
  estado: string;
  dominio: string;
  planner: string;
  owner: string;
  fecha_visita: string;
  hora: string;
  buyer: string;
  nombre_apellido: string;
  telefono: string;
  dni: string;
  vende: string;
  observaciones_visita: string;
};

const EMPTY_FORM: VisitaForm = {
  opportunity_id: "",
  estado: "",
  dominio: "",
  planner: "",
  owner: "",
  fecha_visita: "",
  hora: "",
  buyer: "",
  nombre_apellido: "",
  telefono: "",
  dni: "",
  vende: "",
  observaciones_visita: "",
};

function fmt(d: string | null) {
  if (!d) return "—";
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function getWhatsAppUrl(phone: string | null | undefined) {
  const raw = phone?.trim();
  if (!raw || raw === "—") return "";

  let normalized = raw.replace(/[^\d+]/g, "");
  if (normalized.startsWith("00")) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith("+")) {
    normalized = normalized.slice(1);
  }
  if (/^[67]\d{8}$/.test(normalized)) {
    normalized = `34${normalized}`;
  }

  if (!/^\d{8,15}$/.test(normalized)) return "";
  return `https://wa.me/${normalized}`;
}

function visitaToForm(v: Visita): VisitaForm {
  return {
    opportunity_id: v.opportunity_id ? String(v.opportunity_id) : "",
    estado: v.estado || "",
    dominio: v.dominio || "",
    planner: v.planner || "",
    owner: v.owner || "",
    fecha_visita: v.fecha_visita || "",
    hora: v.hora || "",
    buyer: v.buyer || "",
    nombre_apellido: v.nombre_apellido || "",
    telefono: v.telefono || "",
    dni: v.dni || "",
    vende: v.vende === true ? "si" : v.vende === false ? "no" : "",
    observaciones_visita: v.observaciones_visita || "",
  };
}

export default function VisitasPage() {
  const { userWithRole } = useUser();
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedVisita, setSelectedVisita] = useState<Visita | null>(null);
  const [inmuebles, setInmuebles] = useState<InmuebleOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<VisitaForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<VisitaForm>(EMPTY_FORM);
  const [phoneCopyStatus, setPhoneCopyStatus] = useState<"idle" | "copied">("idle");
  const [selectedPhoneIds, setSelectedPhoneIds] = useState<Set<number>>(new Set());

  async function persistLeadActivity(leadId: number, text: string) {
    const createdBy = userWithRole?.crmUser.name ?? "Usuario";
    const { error } = await supabase.from("opportunity_contacts").insert({
      opportunity_id: leadId,
      fecha: new Date().toISOString().slice(0, 10),
      memo: `${HISTORY_PREFIX} ${createdBy}: ${text}`,
      resultado: true,
    });

    if (error) {
      console.error("Error guardando historial de visita:", error);
    }
  }

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function setEditField(field: string, value: string) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }

  async function loadVisitas() {
    setLoading(true);
    const rol = userWithRole?.crmUser.rol;
    const nombre = userWithRole?.crmUser.name;
    const isVisitador = userWithRole?.crmUser.is_visitador;

    let query = supabase
      .from("visitas")
      .select("*")
      .order("fecha_visita", { ascending: false });

    if (rol === "Comercial" && !isVisitador && nombre) {
      query = query.or(`owner.eq.${nombre},planner.eq.${nombre}`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error cargando visitas:", error);
      setLoading(false);
      return;
    }
    setVisitas((data ?? []) as Visita[]);
    setLoading(false);
  }

  async function loadInmuebles() {
    const { data, error } = await supabase
      .from("crm_leads_view")
      .select("id, propietario, domicilio, comercial_name, dominio_desc, telefono, estado")
      .eq("fase_name", "Encargo")
      .order("propietario", { ascending: true });

    if (error) return;

    setInmuebles((data ?? []).map((row) => ({
      id: row.id as number,
      label: `${row.domicilio || "Sin dirección"} — ${row.propietario || "Sin propietario"}`,
      propietario: row.propietario as string | null,
      domicilio: row.domicilio as string | null,
      owner: row.comercial_name as string | null,
      planner: row.dominio_desc as string | null,
      estado: row.estado as string | null,
      dominio: row.dominio_desc as string | null,
      telefono: row.telefono as string | null,
    })));
  }

  useEffect(() => {
    if (userWithRole) {
      void loadVisitas();
      void loadInmuebles();
    }
  }, [userWithRole]);

  function handleInmuebleSelect(value: string) {
    const inmueble = inmuebles.find((im) => String(im.id) === value);
    setForm((prev) => ({
      ...prev,
      opportunity_id: value,
      estado: inmueble?.estado || "",
      dominio: inmueble?.dominio || "",
      planner: inmueble?.planner || "",
      owner: inmueble?.owner || "",
      nombre_apellido: "",
      telefono: "",
      buyer: userWithRole?.crmUser.name || "",
    }));
  }

  function handleRowClick(v: Visita) {
    setSelectedVisita(v);
    setEditForm(visitaToForm(v));
    setEditModalOpen(true);
  }

  async function handleSaveVisita() {
    if (!form.opportunity_id) return;
    setSaving(true);

    const { error } = await supabase.from("visitas").insert({
      opportunity_id: Number(form.opportunity_id),
      estado: form.estado || null,
      dominio: form.dominio || null,
      planner: form.planner || null,
      owner: form.owner || null,
      fecha_visita: form.fecha_visita || null,
      hora: form.hora || null,
      buyer: form.buyer || null,
      nombre_apellido: form.nombre_apellido || null,
      telefono: form.telefono || null,
      dni: form.dni || null,
      vende: form.vende === "si" ? true : form.vende === "no" ? false : null,
      observaciones_visita: form.observaciones_visita || null,
      created_by: userWithRole?.crmUser.name ?? "Sistema",
    });

    setSaving(false);
    if (error) { console.error("Error guardando visita:", error); return; }

    await persistLeadActivity(Number(form.opportunity_id), "Agregó una visita");
    setAddModalOpen(false);
    setForm(EMPTY_FORM);
    void loadVisitas();
  }

  async function handleUpdateVisita() {
    if (!selectedVisita) return;
    setSaving(true);

    const { error } = await supabase
      .from("visitas")
      .update({
        fecha_visita: editForm.fecha_visita || null,
        hora: editForm.hora || null,
        nombre_apellido: editForm.nombre_apellido || null,
        telefono: editForm.telefono || null,
        buyer: editForm.buyer || null,
        dni: editForm.dni || null,
        vende: editForm.vende === "si" ? true : editForm.vende === "no" ? false : null,
        observaciones_visita: editForm.observaciones_visita || null,
      })
      .eq("id", selectedVisita.id);

    setSaving(false);
    if (error) { console.error("Error actualizando visita:", error); return; }

    if (selectedVisita.opportunity_id !== null) {
      await persistLeadActivity(selectedVisita.opportunity_id, "Editó una visita");
    }
    setEditModalOpen(false);
    setSelectedVisita(null);
    void loadVisitas();
  }

  const filteredVisitas = visitas.filter((v) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return [v.estado, v.dominio, v.planner, v.owner, v.buyer,
      v.nombre_apellido, v.telefono, v.dni, v.observaciones_visita]
      .join(" ").toLowerCase().includes(q);
  });

  const selectedPhoneNumbers = visitas
    .filter((v) => selectedPhoneIds.has(v.id))
    .map((v) => v.telefono?.trim())
    .filter((telefono): telefono is string => Boolean(telefono && telefono !== "—"));

  function togglePhoneSelection(id: number, checked: boolean) {
    setSelectedPhoneIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    setPhoneCopyStatus("idle");
  }

  async function handleCopySelectedPhones() {
    if (selectedPhoneNumbers.length === 0) return;

    const text = selectedPhoneNumbers.join("\n");

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setPhoneCopyStatus("copied");
    window.setTimeout(() => setPhoneCopyStatus("idle"), 1600);
  }

  const columns = ["Estado", "Dominio", "Planner", "Owner", "Inmueble",
    "Fecha", "Hora", "Buyer", "Nombre y Apellido", "Teléfono", "DNI", "Vende?", "Observaciones"];

  return (
    <>
      <Topbar title="Visitas" />

      <main className="mt-14 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-2.5">
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
            <span className="text-xs text-muted-foreground sm:whitespace-nowrap">
              {filteredVisitas.length} visitas en total
            </span>
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar visitas..."
                className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground sm:h-8 sm:w-[260px]"
              />
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              size="sm"
              variant="outline"
              className="h-10 w-full gap-1.5 text-xs font-semibold sm:h-7 sm:w-auto"
              onClick={() => void handleCopySelectedPhones()}
              disabled={selectedPhoneNumbers.length === 0}
              title="Copiar teléfonos seleccionados"
            >
              {phoneCopyStatus === "copied" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {phoneCopyStatus === "copied"
                ? "Copiados"
                : `Copiar seleccionados (${selectedPhoneNumbers.length})`}
            </Button>
            <Button
              size="sm"
              className="h-10 w-full gap-1.5 text-xs font-semibold sm:h-7 sm:w-auto"
              onClick={() => setAddModalOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar Visita
            </Button>
          </div>
        </div>

        {loading && (
          <div className="shrink-0 border-b border-border bg-muted/40 px-6 py-2 text-xs text-muted-foreground">
            Cargando visitas desde Supabase...
          </div>
        )}

        <div className="relative flex-1 overflow-auto">
          <table className="w-full select-none border-collapse text-sm" style={{ minWidth: 1600 }}>
            <thead className="sticky top-0 z-20 bg-card">
              <tr className="border-b border-border bg-card/95 text-left backdrop-blur">
                {columns.map((col) => (
                  <th key={col} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-background">
              {filteredVisitas.length === 0 && !loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-10 text-center text-xs text-muted-foreground">
                    No hay visitas registradas
                  </td>
                </tr>
              ) : (
                filteredVisitas.map((v, i) => {
                  const inmueble = inmuebles.find((im) => im.id === v.opportunity_id);
                  const whatsappUrl = getWhatsAppUrl(v.telefono);
                  return (
                    <tr
                      key={v.id}
                      onClick={() => handleRowClick(v)}
                      className={cn(
                        "cursor-pointer border-b border-border transition-colors hover:bg-accent/60",
                        i % 2 === 0 ? "bg-card" : "bg-background"
                      )}
                    >
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.estado || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.dominio || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.planner || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.owner || "—"}</td>
                      <td className="max-w-[200px] truncate px-3 py-2.5 text-xs text-muted-foreground">
                        {inmueble?.domicilio || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmt(v.fecha_visita)}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.hora || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.buyer || "—"}</td>
                      <td className="px-3 py-2.5 text-xs font-medium text-foreground">{v.nombre_apellido || "—"}</td>
                      <td
                        className="select-text px-3 py-2.5 font-mono text-xs text-muted-foreground"
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                        title="Seleccionar o copiar teléfono"
                      >
                        <div className="flex items-center gap-2">
                          {v.telefono ? (
                            <Checkbox
                              checked={selectedPhoneIds.has(v.id)}
                              onCheckedChange={(checked) =>
                                togglePhoneSelection(v.id, checked === true)
                              }
                              aria-label={`Seleccionar teléfono ${v.telefono}`}
                            />
                          ) : (
                            <span className="h-4 w-4 shrink-0" />
                          )}
                          {whatsappUrl ? (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline-offset-2 hover:underline"
                              onClick={(event) => event.stopPropagation()}
                              title="Abrir WhatsApp"
                            >
                              {v.telefono}
                            </a>
                          ) : (
                            <span>{v.telefono || "—"}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{v.dni || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {v.vende === null ? "—" : v.vende ? "Sí" : "No"}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2.5 text-xs text-muted-foreground">
                        {v.observaciones_visita || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Modal Agregar Visita */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Agregar Visita</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Registrá una nueva visita a un inmueble en encargo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-x-4 gap-y-4 py-2">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Inmueble (Encargo) *</Label>
              <Select value={form.opportunity_id} onValueChange={handleInmuebleSelect}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Seleccioná un inmueble..." />
                </SelectTrigger>
                <SelectContent>
                  {inmuebles.map((im) => (
                    <SelectItem key={im.id} value={String(im.id)} className="text-sm">{im.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Estado</Label>
              <Input value={form.estado} readOnly className="h-8 text-sm bg-muted/40" placeholder="Auto" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Dominio</Label>
              <Input value={form.dominio} readOnly className="h-8 text-sm bg-muted/40" placeholder="Auto" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Planner</Label>
              <Input value={form.planner} readOnly className="h-8 text-sm bg-muted/40" placeholder="Auto" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Owner</Label>
              <Input value={form.owner} readOnly className="h-8 text-sm bg-muted/40" placeholder="Auto" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Fecha visita</Label>
              <Input type="date" value={form.fecha_visita} onChange={(e) => setField("fecha_visita", e.target.value)} className="h-8 text-sm" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Hora</Label>
              <Input type="time" value={form.hora} onChange={(e) => setField("hora", e.target.value)} className="h-8 text-sm" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Nombre y Apellido (Comprador)</Label>
              <Input value={form.nombre_apellido} onChange={(e) => setField("nombre_apellido", e.target.value)} className="h-8 text-sm" placeholder="Nombre del comprador" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Teléfono</Label>
              <Input value={form.telefono} onChange={(e) => setField("telefono", e.target.value)} className="h-8 text-sm" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Buyer (Visitador)</Label>
              <Input value={form.buyer} readOnly className="h-8 text-sm bg-muted/40" placeholder="Auto" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">DNI (Comprador)</Label>
              <Input value={form.dni} onChange={(e) => setField("dni", e.target.value)} className="h-8 text-sm" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">¿Vende?</Label>
              <Select value={form.vende} onValueChange={(v) => setField("vende", v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Seleccioná..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="si" className="text-sm">Sí</SelectItem>
                  <SelectItem value="no" className="text-sm">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Observaciones</Label>
              <Textarea value={form.observaciones_visita} onChange={(e) => setField("observaciones_visita", e.target.value)} className="text-sm min-h-[72px] resize-none" placeholder="Observaciones de la visita..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button size="sm" onClick={() => void handleSaveVisita()} disabled={saving || !form.opportunity_id}>
              {saving ? "Guardando..." : "Guardar visita"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Visita */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Editar visita</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {inmuebles.find((im) => im.id === selectedVisita?.opportunity_id)?.label || "Visita"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-x-4 gap-y-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Estado</Label>
              <Input value={editForm.estado} readOnly className="h-8 text-sm bg-muted/40" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Dominio</Label>
              <Input value={editForm.dominio} readOnly className="h-8 text-sm bg-muted/40" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Fecha visita</Label>
              <Input type="date" value={editForm.fecha_visita} onChange={(e) => setEditField("fecha_visita", e.target.value)} className="h-8 text-sm" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Hora</Label>
              <Input type="time" value={editForm.hora} onChange={(e) => setEditField("hora", e.target.value)} className="h-8 text-sm" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Nombre y Apellido (Comprador)</Label>
              <Input value={editForm.nombre_apellido} onChange={(e) => setEditField("nombre_apellido", e.target.value)} className="h-8 text-sm" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Teléfono</Label>
              <Input value={editForm.telefono} onChange={(e) => setEditField("telefono", e.target.value)} className="h-8 text-sm" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Buyer (Visitador)</Label>
              <Input value={editForm.buyer} readOnly className="h-8 text-sm bg-muted/40" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">DNI (Comprador)</Label>
              <Input value={editForm.dni} onChange={(e) => setEditField("dni", e.target.value)} className="h-8 text-sm" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">¿Vende?</Label>
              <Select value={editForm.vende} onValueChange={(v) => setEditField("vende", v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Seleccioná..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="si" className="text-sm">Sí</SelectItem>
                  <SelectItem value="no" className="text-sm">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Observaciones</Label>
              <Textarea value={editForm.observaciones_visita} onChange={(e) => setEditField("observaciones_visita", e.target.value)} className="text-sm min-h-[72px] resize-none" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button size="sm" onClick={() => void handleUpdateVisita()} disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
