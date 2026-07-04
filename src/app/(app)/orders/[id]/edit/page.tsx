"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/contexts/user-profile-context";
import { canEditOrders } from "@/lib/permissions";
import { es } from "@/locales/es";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/list-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import type { Order } from "@/types/database";

export default function EditOrderPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { profile } = useUserProfile();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    requester_name: "",
    requester_phone: "",
    requester_email: "",
    requester_address: "",
    requester_city: "",
    requester_state: "",
    requester_notes: "",
  });

  useEffect(() => {
    if (profile && !canEditOrders(profile.role)) {
      router.replace(`/orders/${id}`);
      return;
    }
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.from("orders").select("*").eq("id", id).single();
      if (data) {
        setForm({
          requester_name: data.requester_name,
          requester_phone: data.requester_phone ?? "",
          requester_email: data.requester_email ?? "",
          requester_address: data.requester_address ?? "",
          requester_city: data.requester_city ?? "",
          requester_state: data.requester_state ?? "",
          requester_notes: data.requester_notes ?? "",
        });
      }
      setLoading(false);
    }
    load();
  }, [profile, id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: oldOrder } = await supabase.from("orders").select("*").eq("id", id).single();

    await supabase.from("orders").update(form).eq("id", id);

    if (user && oldOrder) {
      const fields = Object.keys(form) as (keyof typeof form)[];
      for (const field of fields) {
        const oldVal = (oldOrder as Order)[field as keyof Order]?.toString() ?? "";
        const newVal = form[field];
        if (oldVal !== newVal) {
          await supabase.from("order_history").insert({
            order_id: id,
            changed_by: user.id,
            field,
            old_value: oldVal,
            new_value: newVal,
          });
        }
      }
    }

    setSaving(false);
    showToast(es.orders.updated_success);
    router.push(`/orders/${id}`);
  }

  if (loading) return <ListSkeleton variant="detail" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title={es.orders.edit}
        action={
          <Link href={`/orders/${id}`}>
            <Button variant="outline" size="sm">
              {es.app.cancel}
            </Button>
          </Link>
        }
      />

      <Card className="border-border bg-surface-1">
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {(
              [
                ["requester_name", es.orders.requesterName],
                ["requester_phone", es.orders.phone],
                ["requester_email", es.orders.email],
                ["requester_address", es.orders.address],
                ["requester_city", es.orders.city],
                ["requester_state", es.orders.state],
                ["requester_notes", es.orders.notes],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Input
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  required={key === "requester_name"}
                />
              </div>
            ))}
            <Button type="submit" disabled={saving}>
              {saving ? es.app.loading : es.app.save}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
