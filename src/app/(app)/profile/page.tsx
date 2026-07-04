"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/contexts/user-profile-context";
import { es } from "@/locales/es";
import { PageHeader } from "@/components/page-header";
import { Avatar, getInitials } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";

export default function ProfilePage() {
  const router = useRouter();
  const { profile, refresh } = useUserProfile();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    setForm({
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
    });
  }, [profile]);

  if (!profile) return null;

  const initials = getInitials(
    profile.first_name,
    profile.last_name,
    profile.name,
    profile.role
  );
  const displayName =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.name;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const firstName = form.first_name.trim();
    const lastName = form.last_name.trim();
    const name = [firstName, lastName].filter(Boolean).join(" ");

    const supabase = createClient();
    const baseUpdate = {
      name: name || profile!.email,
    };
    const extendedUpdate = {
      ...baseUpdate,
      first_name: firstName || null,
      last_name: lastName || null,
    };

    let { error: updateError } = await supabase
      .from("profiles")
      .update(extendedUpdate)
      .eq("id", profile!.id);

    if (updateError?.message?.includes("first_name")) {
      ({ error: updateError } = await supabase
        .from("profiles")
        .update(baseUpdate)
        .eq("id", profile!.id));
    }

    setSaving(false);
    if (updateError) {
      setError(es.app.error);
      return;
    }

    await refresh();
    showToast(es.menu.profileUpdated);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={es.menu.profile}
        description={es.menu.profileDescription}
        action={
          <Link href="/slots">
            <Button variant="outline" size="sm">
              {es.app.back}
            </Button>
          </Link>
        }
      />

      <Card className="border-border bg-surface-1">
        <CardContent className="space-y-6 p-4">
          <div className="flex items-center gap-3">
            <Avatar initials={initials} size="lg" />
            <div>
              <p className="font-medium">{displayName}</p>
              <p className="text-sm text-muted">{profile.email}</p>
            </div>
          </div>

          <Separator />

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">{es.menu.firstName}</Label>
                <Input
                  id="first_name"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">{es.menu.lastName}</Label>
                <Input
                  id="last_name"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <p className="text-sm font-medium text-muted">{es.menu.readOnly}</p>
              <div className="space-y-2">
                <Label htmlFor="email">{es.auth.email}</Label>
                <Input id="email" value={profile.email} disabled readOnly />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{es.menu.phone}</Label>
                <Input
                  id="phone"
                  value={profile.phone ?? "—"}
                  disabled
                  readOnly
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{es.menu.role}</Label>
                  <div>
                    <Badge variant="secondary">{es.users.roles[profile.role]}</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{es.users.status}</Label>
                  <div>
                    <Badge variant="secondary">{es.users.statuses[profile.status]}</Badge>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{es.users.created}</Label>
                <p className="text-sm">{formatDate(profile.created_at)}</p>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full sm:w-auto" disabled={saving}>
              {saving ? es.app.loading : es.app.save}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
