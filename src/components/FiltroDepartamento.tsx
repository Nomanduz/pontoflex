import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Departamentos já usados nos cadastros da empresa. */
export function useDepartamentos() {
  return useQuery({
    queryKey: ["departamentos"],
    queryFn: async () => {
      const { data } = await supabase.from("funcionarios").select("departamento");
      return [...new Set((data ?? []).map((d) => d.departamento).filter(Boolean) as string[])].sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      );
    },
  });
}

export function FiltroDepartamento({
  valor,
  onChange,
  label = "Departamento",
  todosLabel = "Todos os departamentos",
}: {
  valor: string;
  onChange: (v: string) => void;
  label?: string;
  todosLabel?: string;
}) {
  const { data } = useDepartamentos();
  if (!data?.length) return null;
  return (
    <div className="min-w-48 space-y-1">
      <Label>{label}</Label>
      <Select value={valor} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">{todosLabel}</SelectItem>
          {data.map((d) => (
            <SelectItem key={d} value={d}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
