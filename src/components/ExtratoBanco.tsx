import { calcularBanco, formatarMinutos, ORIGEM_LABEL, type Movimento } from "@/lib/banco-horas";

const br = (k: string) => k.split("-").reverse().join("/");

/** Saldo, vencimentos e extrato do banco de horas (usado pela empresa e pelo funcionário). */
export function ExtratoBanco({
  movimentos,
  prazoMeses,
  hoje,
  onExcluir,
}: {
  movimentos: (Movimento & { id?: string })[];
  prazoMeses: number;
  hoje: string;
  onExcluir?: (id: string) => void;
}) {
  const b = calcularBanco(movimentos, prazoMeses, hoje);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p
            className={`font-display text-2xl font-bold ${b.saldo < 0 ? "text-destructive" : "text-primary"}`}
          >
            {formatarMinutos(b.saldo)}
          </p>
        </div>
        {b.aVencer[0] && (
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Próximo vencimento</p>
            <p className="font-semibold">
              {formatarMinutos(b.aVencer[0].minutos, false)} até {br(b.aVencer[0].venceEm)}
            </p>
          </div>
        )}
        {b.vencidas > 0 && (
          <div className="rounded-lg border border-destructive p-3">
            <p className="text-xs text-destructive">Vencidas (pagar como extra)</p>
            <p className="font-semibold text-destructive">{formatarMinutos(b.vencidas, false)}</p>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {prazoMeses
          ? `Horas a mais devem ser compensadas em até ${prazoMeses} meses (CLT art. 59). Depois disso, são pagas como horas extras.`
          : "Banco de horas desativado pela empresa: o saldo é só informativo."}{" "}
        O mês atual entra quando a folha for fechada.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-1">Data</th>
              <th>Movimento</th>
              <th className="text-right">Horas</th>
              <th className="text-right">Saldo</th>
              {onExcluir && <th />}
            </tr>
          </thead>
          <tbody>
            {b.extrato.length === 0 && (
              <tr>
                <td colSpan={5} className="py-2 text-muted-foreground">
                  Nenhum movimento ainda.
                </td>
              </tr>
            )}
            {b.extrato.map((m, i) => (
              <tr key={i} className="border-t">
                <td className="whitespace-nowrap py-1.5">{br(m.data)}</td>
                <td>
                  <span className="text-xs text-muted-foreground">{ORIGEM_LABEL[m.origem]}</span>
                  <br />
                  {m.descricao}
                </td>
                <td className={`text-right font-mono ${m.minutos < 0 ? "text-destructive" : ""}`}>
                  {formatarMinutos(m.minutos)}
                </td>
                <td className="text-right font-mono">{formatarMinutos(m.saldo)}</td>
                {onExcluir && (
                  <td className="text-right">
                    {(m as { id?: string }).id && (
                      <button
                        type="button"
                        className="text-xs text-destructive hover:underline print:hidden"
                        onClick={() => onExcluir((m as { id?: string }).id!)}
                      >
                        excluir
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
