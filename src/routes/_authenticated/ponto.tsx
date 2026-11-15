import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/ponto")({
  beforeLoad: ({ context }) => {
    if (context.papel === "admin") throw redirect({ to: "/admin" });
    if (context.papel === "superadmin") throw redirect({ to: "/nomanduz" });
  },
  component: () => (
    <AppShell
      papel="funcionario"
      links={[
        { to: "/ponto", label: "Registrar ponto" },
        { to: "/ponto/comunica", label: "Comunica RH" },
        { to: "/ponto/historico", label: "Espelho" },
        { to: "/ponto/banco", label: "Banco de horas" },
        { to: "/ponto/ferias", label: "Férias" },
        { to: "/ponto/atestados", label: "Atestados" },
        { to: "/ponto/ajustes", label: "Ajustar ponto" },
        { to: "/ponto/folhas", label: "Assinar folhas" },
        { to: "/ponto/perfil", label: "Meu perfil" },
      ]}
    >
      <Outlet />
    </AppShell>
  ),
});
