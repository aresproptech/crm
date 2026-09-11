"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type MaskedPhoneProps = {
  value?: string | null;
  className?: string;
  emptyValue?: string;
};

export function maskPhoneNumber(value: string) {
  const characters = Array.from(value);
  let hiddenDigits = 0;

  for (let index = characters.length - 1; index >= 0 && hiddenDigits < 3; index -= 1) {
    if (/\d/.test(characters[index])) {
      characters[index] = "X";
      hiddenDigits += 1;
    }
  }

  return characters.join("");
}

export function MaskedPhone({ value, className, emptyValue = "—" }: MaskedPhoneProps) {
  const phone = value?.trim();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);

  if (!phone || phone === "—") {
    return <span className={className}>{emptyValue}</span>;
  }

  const revealed = hovered || pinned;

  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={revealed ? "Ocultar número de teléfono" : "Mostrar número de teléfono"}
      aria-pressed={revealed}
      title={revealed ? "Ocultar número" : "Mostrar número"}
      className={cn(
        "inline-flex max-w-full cursor-pointer items-center gap-1 rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/35",
        className
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.focus();
        setPinned((current) => !current);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        setPinned((current) => !current);
      }}
      onBlur={() => setPinned(false)}
    >
      <span className="truncate font-mono">{revealed ? phone : maskPhoneNumber(phone)}</span>
      {revealed ? (
        <EyeOff aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />
      ) : (
        <Eye aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />
      )}
    </span>
  );
}
