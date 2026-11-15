import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FiltroDepartamento } from "@/components/FiltroDepartamento";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calcularBanco, formatarMinutos } from "@/lib/banco-horas";
import { carregarMovimentos } from "@/lib/banco-horas-dados";
import { dayKey } from "@/lib/ponto";

export const Route = createFileRoute("/_authenticated/admin/banco")({
  head: () => ({ meta: [{ title: "Banco de horas — PontoFlex" }] }),
  component: BancoEmpresa,
});

function BancoEmpresa() {
  const qc = useQueryClient();
  const hoje = dayKey(new Date());
  const [depto, setDepto] = useState("todos");
  const { data } = useQuery({
    queryKey: ["banco-empresa"],
    queryFn: async () => {
      const [{ data: emp }, { data: funcs }] = await Promise.all([
        supabase.from("empresas").select("id, banco_horas_meses").maybeSingle(),
        supabase
          .from("funcionarios")
          .select("id, nome, departamento, ativo")
          .is("data_desligamento", null)
          .order("nome"),
      ]);
      const movs = await carregarMovimentos((funcs ?? []).map((f) => f.id));
      const prazo = emp?.banco_horas_meses ?? 6;
      return {
        emp,
        linhas: (funcs ?? []).map((f) => ({
          ...f,
          banco: calcularBanco(movs.get(f.id) ?? [], prazo, hoje),
        })),
      };
    },
  });

  async function mudarPrazo(v: string) {
    const { error } = await supabase
      .from("empresas")
      .update({ banco_horas_meses: Number(v) })
      .eq("id", data!.emp!.id);
    if (error) toast.error("Não foi possível salvar");
    else {
      toast.success("Prazo atualizado");
      qc.invalidateQueries({ queryKey: ["banco-empresa"] });
    }
  }

  const linhas = (data?.linhas ?? []).filter((l) => depto === "todos" || l.departamento === depto);
  const total = linhas.reduce((s, l) => s + l.banco.saldo, 0);

  return (
    <>
      <h1 className="font-display text-2xl font-bold">Banco de horas</h1>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Regra da empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="max-w-xs space-y-1">
            <Label>Prazo para compensar as horas</Label>
            <Select value={String(data?.emp?.banco_horas_meses ?? 6)} onValueChange={mudarPrazo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6 meses (acordo individual escrito)</SelectItem>
                <SelectItem value="12">12 meses (acordo/convenção coletiva)</SelectItem>
                <SelectItem value="0">Sem banco de horas (só acompanhamento)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            CLT art. 59: o banco de horas precisa de acordo escrito com o funcionário (até 6 meses)
            ou de acordo/convenção coletiva (até 12 meses). Horas não compensadas no prazo são pagas
            como extras. O saldo de cada mês entra quando você fecha a folha; folgas e pagamentos
            são lançados na ficha do funcionário.
          </p>
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FiltroDepartamento valor={depto} onChange={setDepto} />
        <p className="text-sm">
          Saldo total: <strong>{formatarMinutos(total)}</strong>
        </p>
      </div>
      <Card>
        <CardContent className="overflow-x-auto pt-4">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">Funcionário</th>
                <th className="hidden sm:table-cell">Departamento</th>
                <th className="text-right">Saldo</th>
                <th className="text-right">Vencidas</th>
                <th className="hidden text-right sm:table-cell">Próximo vencimento</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="py-2">
                    <Link
                      to="/admin/funcionario/$id"
                      params={{ id: l.id }}
                      className="font-medium hover:underline"
                    >
                      {l.nome}
                    </Link>
                  </td>
                  <td className="hidden sm:table-cell">{l.departamento ?? "—"}</td>
                  <td
                    className={`text-right font-mono ${l.banco.saldo < 0 ? "text-destructive" : ""}`}
                  >
                    {formatarMinutos(l.banco.saldo)}
                  </td>
                  <td className="text-right font-mono text-destructive">
                    {l.banco.vencidas ? formatarMinutos(l.banco.vencidas, false) : ""}
                  </td>
                  <td className="hidden text-right text-xs sm:table-cell">
                    {l.banco.aVencer[0]
                      ? `${formatarMinutos(l.banco.aVencer[0].minutos, false)} até ${l.banco.aVencer[0].venceEm.split("-").reverse().join("/")}`
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {linhas.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">Nenhum funcionário.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
