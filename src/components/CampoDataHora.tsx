/**
 * Campos de data (DD/MM/AAAA) e hora (24 h) sempre no padrão brasileiro.
 * Os campos nativos do navegador seguem o idioma do aparelho e podem aparecer como MM/DD/AAAA
 * e AM/PM; estes não. O valor entregue continua no formato ISO (AAAA-MM-DD / HH:MM).
 */
import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ---------- Funções puras (testadas em regras.test.ts) ----------
export function mascararData(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function mascararHora(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** "15/11/2026" → "2026-11-15"; data incompleta ou inexistente (31/02) → "". */
export function dataParaIso(br: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  if (!m) return "";
  const [, dd, mm, aaaa] = m;
  const d = new Date(Date.UTC(Number(aaaa), Number(mm) - 1, Number(dd)));
  if (
    d.getUTCFullYear() !== Number(aaaa) ||
    d.getUTCMonth() !== Number(mm) - 1 ||
    d.getUTCDate() !== Number(dd) ||
    Number(aaaa) < 1900
  )
    return "";
  return `${aaaa}-${mm}-${dd}`;
}

export function isoParaData(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** "7:05" ou "07:05" ou "07:05:00" → "07:05"; inválida → "". */
export function horaValida(h: string): string {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(h ?? "");
  if (!m) return "";
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return "";
  return `${String(hh).padStart(2, "0")}:${m[2]}`;
}

type Base = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function CampoData({ id, value, onChange, required, className, ...rest }: Base) {
  const [texto, setTexto] = useState(() => isoParaData(value));
  const nativo = useRef<HTMLInputElement>(null);

  // Valor trocado por fora (ex.: formulário limpo): atualiza o texto.
  useEffect(() => {
    if (dataParaIso(texto) !== (value ?? "")) setTexto(isoParaData(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function mudar(v: string) {
    const t = mascararData(v);
    setTexto(t);
    onChange(dataParaIso(t));
  }

  const invalida = texto.length === 10 && !dataParaIso(texto);
  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="DD/MM/AAAA"
        autoComplete="off"
        maxLength={10}
        required={required}
        pattern="\d{2}/\d{2}/\d{4}"
        title="Use o formato DD/MM/AAAA"
        aria-invalid={invalida || undefined}
        value={texto}
        onChange={(e) => {
          mudar(e.target.value);
          e.target.setCustomValidity(
            e.target.value.length === 10 && !dataParaIso(mascararData(e.target.value))
              ? "Data inexistente"
              : "",
          );
        }}
        className="pr-10"
        {...rest}
      />
      <button
        type="button"
        aria-label="Abrir calendário"
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
        onClick={() => {
          const el = nativo.current;
          if (!el) return;
          try {
            el.showPicker();
          } catch {
            el.focus();
          }
        }}
      >
        <CalendarDays className="size-4" />
      </button>
      {/* Calendário do aparelho só como atalho para escolher o dia; o texto fica em DD/MM/AAAA. */}
      <input
        ref={nativo}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
        value={dataParaIso(texto)}
        onChange={(e) => mudar(isoParaData(e.target.value))}
      />
    </div>
  );
}

export function CampoHora({ id, value, onChange, required, className, ...rest }: Base) {
  const [texto, setTexto] = useState(() => horaValida(value));

  useEffect(() => {
    if (horaValida(texto) !== horaValida(value ?? "")) setTexto(horaValida(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      id={id}
      inputMode="numeric"
      placeholder="HH:MM"
      autoComplete="off"
      maxLength={5}
      required={required}
      pattern="([01]\d|2[0-3]):[0-5]\d"
      title="Use o formato 24 horas, ex.: 13:45"
      value={texto}
      onChange={(e) => {
        const t = mascararHora(e.target.value);
        setTexto(t);
        onChange(t.length === 5 ? horaValida(t) : "");
      }}
      className={className}
      {...rest}
    />
  );
}
