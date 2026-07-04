import { AppShell } from "@/components/app-shell";
import { UserProfileProvider } from "@/contexts/user-profile-context";
import { getCurrentProfile } from "@/lib/auth-helpers";
import type { Profile } from "@/types/database";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = (await getCurrentProfile()) as Profile | null;

  return (
    <UserProfileProvider initialProfile={profile}>
      <AppShell>{children}</AppShell>
    </UserProfileProvider>
  );
}
