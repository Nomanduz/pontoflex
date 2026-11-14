import { Clock3 } from "lucide-react";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight ${className}`}
    >
      <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground">
        <Clock3 className="size-4" />
      </span>
      PontoFlex
    </span>
  );
}
