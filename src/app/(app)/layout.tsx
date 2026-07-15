import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { UIProvider } from "@/components/ui-provider";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <WorkspaceProvider userId={user.id}>
      <UIProvider>
        <AppShell>{children}</AppShell>
      </UIProvider>
    </WorkspaceProvider>
  );
}
