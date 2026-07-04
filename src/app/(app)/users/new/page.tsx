"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { es } from "@/locales/es";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import type { UserRole } from "@/types/database";

export default function NewUserPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    role: "staff" as UserRole,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? es.app.error);
      return;
    }

    showToast(es.users.created_success);
    router.push("/users");
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={es.users.create}
        action={
          <Link href="/users">
            <Button variant="outline" size="sm">
              {es.app.cancel}
            </Button>
          </Link>
        }
      />

      <Card className="border-border bg-surface-1">
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{es.menu.firstName}</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{es.menu.lastName}</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{es.auth.email}</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{es.menu.phone}</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{es.auth.password}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label>{es.users.role}</Label>
              <select
                className="h-11 w-full rounded-lg border border-border bg-surface-1 px-3"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              >
                <option value="staff">{es.users.roles.staff}</option>
                <option value="collaborator">{es.users.roles.collaborator}</option>
                <option value="admin">{es.users.roles.admin}</option>
              </select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? es.app.loading : es.users.create}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
