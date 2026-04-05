import { Topbar } from "@/components/crm/topbar";
import { Settings } from "lucide-react";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

export default function AjustesPage() {
  return (
    <>
      <Topbar title="Ajustes" />
      <main className="flex flex-col flex-1 overflow-hidden mt-14 min-h-0">
        <div className="flex shrink-0 items-center border-b border-border bg-card px-6 py-2.5">
          <span className="text-xs text-muted-foreground">
            Configuración general de la cuenta y el workspace
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Empty>
            <EmptyContent>
              <EmptyHeader>
                <EmptyMedia>
                  <Settings className="h-8 w-8 text-muted-foreground/40" />
                </EmptyMedia>
                <EmptyTitle>Ajustes del workspace</EmptyTitle>
                <EmptyDescription>
                  La configuración de la cuenta, integraciones y pipeline
                  estará disponible aquí.
                </EmptyDescription>
              </EmptyHeader>
            </EmptyContent>
          </Empty>
        </div>
      </main>
    </>
  );
}