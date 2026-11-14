import type { Folha } from "@/lib/escala";
import { formatDuration, formatKey, formatTime, TIPOS } from "@/lib/ponto";

export function FolhaTabela({ folha }: { folha: Folha }) {
  const t = folha.totais;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {[
          ["Previsto", formatDuration(t.previsto)],
          ["Trabalhado", formatDuration(t.trabalhado)],
          ["Saldo", formatDuration(t.saldo)],
          ["Faltas", String(t.faltas)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">{k}</p>
            <p
              className={`font-display text-lg font-bold ${k === "Saldo" && t.saldo < 0 ? "text-destructive" : ""}`}
            >
              {v}
            </p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1">Dia</th>
              <th>Ent.</th>
              <th>Saí. alm.</th>
              <th>Ret.</th>
              <th>Saída</th>
              <th className="text-right">Trab.</th>
              <th className="text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {folha.dias.map((d) => (
              <tr
                key={d.dia}
                className={`border-t ${!d.trabalho ? "bg-muted/50 text-muted-foreground" : ""}`}
              >
                <td className="whitespace-nowrap py-1 capitalize">{formatKey(d.dia)}</td>
                {d.marcacoes.length === 0 ? (
                  <td colSpan={4} className={d.falta ? "font-semibold text-destructive" : ""}>
                    {d.falta ? "Falta" : d.trabalho ? "" : "Folga"}
                  </td>
                ) : (
                  TIPOS.map((tp) => {
                    const m = d.marcacoes.find((x) => x.tipo === tp);
                    return (
                      <td key={tp} className="font-mono">
                        {m ? formatTime(m.data_hora) : "—"}
                      </td>
                    );
                  })
                )}
                <td className="text-right font-mono">
                  {d.trabalhado ? formatDuration(d.trabalhado) : ""}
                </td>
                <td className={`text-right font-mono ${d.saldo < 0 ? "text-destructive" : ""}`}>
                  {d.saldo ? formatDuration(d.saldo) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
