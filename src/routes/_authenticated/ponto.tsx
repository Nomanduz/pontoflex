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
        { to: "/ponto/historico", label: "Espelho" },
        { to: "/ponto/folhas", label: "Assinar folhas" },
        { to: "/ponto/ajustes", label: "Esqueci o ponto" },
        { to: "/ponto/conta", label: "Minha senha" },
      ]}
    >
      <Outlet />
    </AppShell>
  ),
});
