import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getPapel } from "@/lib/session";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { userId, papel } = await getPapel();
    if (!userId) throw redirect({ to: "/login" });
    return { userId, papel };
  },
  component: () => <Outlet />,
});
