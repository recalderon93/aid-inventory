"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/contexts/user-profile-context";
import { useTheme } from "@/components/providers";
import { canManageUsers } from "@/lib/permissions";
import { es } from "@/locales/es";
import { Avatar, getInitials } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { LogOut, Users, Sun, Moon, Monitor } from "lucide-react";

type MenuView = "main" | "password";

interface UserMenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserMenuSheet({ open, onOpenChange }: UserMenuSheetProps) {
  const router = useRouter();
  const { profile } = useUserProfile();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();
  const [view, setView] = useState<MenuView>("main");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!profile) return null;

  const initials = getInitials(profile.first_name, profile.last_name, profile.name);
  const displayName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.name;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    onOpenChange(false);
    router.push("/login");
    router.refresh();
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError(es.auth.passwordTooShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(es.auth.passwordMismatch);
      return;
    }

    setLoading(true);
    setError("");
    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile!.email,
      password: currentPassword,
    });
    if (signInError) {
      setError(es.auth.loginError);
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setError(es.app.error);
      setLoading(false);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: "password_change",
      entity_type: "profile",
      entity_id: profile!.id,
      actor_id: profile!.id,
    });

    showToast(es.auth.passwordUpdated);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setView("main");
    setLoading(false);
  }

  const themeOptions = [
    { value: "light" as const, label: es.menu.themeLight, icon: Sun },
    { value: "dark" as const, label: es.menu.themeDark, icon: Moon },
    { value: "system" as const, label: es.menu.themeSystem, icon: Monitor },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-center gap-3">
            <Avatar initials={initials} size="lg" />
            <div>
              <SheetTitle>{displayName}</SheetTitle>
              <p className="text-sm text-muted">{profile.email}</p>
            </div>
          </div>
        </SheetHeader>

        <SheetBody>
          {view === "main" ? (
            <div className="space-y-6">
              <div className="space-y-3 rounded-xl border border-border bg-surface-2 p-4">
                <h3 className="text-sm font-medium">{es.menu.profile}</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">{es.menu.firstName}</dt>
                    <dd>{profile.first_name || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">{es.menu.lastName}</dt>
                    <dd>{profile.last_name || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">{es.auth.email}</dt>
                    <dd className="truncate">{profile.email}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">{es.menu.phone}</dt>
                    <dd>{profile.phone || "—"}</dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={() => setView("password")}>
                  {es.menu.changePassword}
                </Button>
                {canManageUsers(profile.role) && (
                  <Link href="/users" onClick={() => onOpenChange(false)}>
                    <Button variant="outline" className="w-full justify-start">
                      <Users className="h-4 w-4" />
                      {es.menu.userManagement}
                    </Button>
                  </Link>
                )}
              </div>

              <div className="space-y-2">
                <Label>{es.menu.theme}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {themeOptions.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTheme(value)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition-colors",
                        theme === value
                          ? "border-foreground bg-surface-2"
                          : "border-border hover:bg-surface-2"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <Button type="button" variant="ghost" size="sm" onClick={() => setView("main")}>
                {es.app.back}
              </Button>
              <h3 className="font-medium">{es.menu.changePassword}</h3>
              <div className="space-y-2">
                <Label>{es.auth.currentPassword}</Label>
                <PasswordInput
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{es.auth.newPassword}</Label>
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{es.auth.confirmPassword}</Label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? es.app.loading : es.app.save}
              </Button>
            </form>
          )}
        </SheetBody>

        {view === "main" && (
          <SheetFooter>
            <Button variant="destructive" className="w-full" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              {es.auth.logout}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
