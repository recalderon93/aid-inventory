"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generateOrderNumber, canCreateOrders } from "@/lib/permissions";
import { useUserProfile } from "@/contexts/user-profile-context";
import { es } from "@/locales/es";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DonationItemPreview } from "@/components/donation-item-preview";
import { VENEZUELAN_STATES, type DonationItem } from "@/types/database";

interface OrderLine {
  donation_item_id: string;
  description: string;
  presentation: string | null;
  unit_of_measurement: string | null;
  subcategory: string | null;
  category: string;
  status: DonationItem["status"];
  requested_quantity: number;
  available: number;
}

export default function NewOrderPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useUserProfile();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [requester, setRequester] = useState({
    requester_name: "",
    requester_phone: "",
    requester_email: "",
    requester_address: "",
    requester_city: "",
    requester_state: "",
    requester_notes: "",
  });
  const [itemSearch, setItemSearch] = useState("");
  const [searchResults, setSearchResults] = useState<DonationItem[]>([]);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profileLoading) return;
    if (!profile || !canCreateOrders(profile.role)) {
      router.replace("/orders");
    }
  }, [profile, profileLoading, router]);

  useEffect(() => {
    if (itemSearch.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("donation_items")
        .select("*")
        .ilike("description", `%${itemSearch}%`)
        .is("deleted_at", null)
        .limit(10);
      setSearchResults(data ?? []);
    }, 300);
    return () => clearTimeout(timer);
  }, [itemSearch]);

  async function addLine(item: DonationItem) {
    const supabase = createClient();
    const { data: inv } = await supabase
      .from("inventory")
      .select("quantity")
      .eq("donation_item_id", item.id);
    const available = (inv ?? []).reduce((s, r) => s + r.quantity, 0);

    if (lines.some((l) => l.donation_item_id === item.id)) return;

    setLines([...lines, {
      donation_item_id: item.id,
      description: item.description,
      presentation: item.presentation,
      unit_of_measurement: item.unit_of_measurement,
      subcategory: item.subcategory,
      category: item.category,
      status: item.status,
      requested_quantity: 1,
      available,
    }]);
    setItemSearch("");
    setSearchResults([]);
  }

  async function handleSubmit() {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        order_number: generateOrderNumber(),
        ...requester,
        status: "pending",
        created_by_user_id: user?.id,
      })
      .select()
      .single();

    if (error || !order) {
      setSaving(false);
      return;
    }

    await supabase.from("order_items").insert(
      lines.map((line) => ({
        order_id: order.id,
        donation_item_id: line.donation_item_id,
        requested_quantity: line.requested_quantity,
        status: line.available >= line.requested_quantity ? "pending" : "unavailable",
      }))
    );

    setSaving(false);
    router.push(`/orders/${order.id}`);
  }

  if (step === 1) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">{es.orders.create}</h2>
        <Card>
          <CardHeader><CardTitle>{es.orders.requester}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {([
              ["requester_name", es.orders.requesterName],
              ["requester_phone", es.orders.phone],
              ["requester_email", es.orders.email],
              ["requester_address", es.orders.address],
              ["requester_city", es.orders.city],
            ] as const).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  value={requester[key]}
                  onChange={(e) => setRequester({ ...requester, [key]: e.target.value })}
                  required={key === "requester_name"}
                />
              </div>
            ))}
            <div className="space-y-1">
              <Label>{es.orders.state}</Label>
              <select
                className="h-11 w-full rounded-lg border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-950"
                value={requester.requester_state}
                onChange={(e) => setRequester({ ...requester, requester_state: e.target.value })}
              >
                <option value="">—</option>
                {VENEZUELAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>{es.orders.notes}</Label>
              <Input
                value={requester.requester_notes}
                onChange={(e) => setRequester({ ...requester, requester_notes: e.target.value })}
              />
            </div>
            <Button onClick={() => setStep(2)} disabled={!requester.requester_name.trim()}>
              {es.inventory.continue}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">{es.orders.items}</h2>
        <Input
          placeholder={es.inventory.searchPlaceholder}
          value={itemSearch}
          onChange={(e) => setItemSearch(e.target.value)}
        />
        {searchResults.map((item) => (
          <button
            key={item.id}
            type="button"
            className="block w-full rounded-lg border border-border bg-surface-1 p-3 text-left transition-colors hover:bg-surface-2"
            onClick={() => addLine(item)}
          >
            <DonationItemPreview
              description={item.description}
              presentation={item.presentation}
              unit_of_measurement={item.unit_of_measurement}
              subcategory={item.subcategory}
              category={item.category}
              status={item.status}
              showQuantity={false}
            />
          </button>
        ))}
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={line.donation_item_id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-1 p-3">
              <div className="min-w-0 flex-1">
                <DonationItemPreview
                  description={line.description}
                  presentation={line.presentation}
                  unit_of_measurement={line.unit_of_measurement}
                  subcategory={line.subcategory}
                  category={line.category}
                  status={line.status}
                  quantity={line.available}
                  showQuantity={false}
                />
                <p className="mt-1 text-xs text-muted">
                  {es.orders.available}: {line.available}
                </p>
              </div>
              <Input
                type="number"
                min={1}
                className="w-20"
                value={line.requested_quantity}
                onChange={(e) => {
                  const updated = [...lines];
                  updated[i].requested_quantity = Math.max(1, parseInt(e.target.value) || 1);
                  setLines(updated);
                }}
              />
            </div>
          ))}
        </div>
        <Button onClick={() => setStep(3)} disabled={lines.length === 0}>
          {es.orders.review}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{es.orders.review}</h2>
      <Card>
        <CardContent className="space-y-2 pt-4">
          <p><strong>{es.orders.requesterName}:</strong> {requester.requester_name}</p>
          <p><strong>{es.orders.phone}:</strong> {requester.requester_phone}</p>
          <p><strong>{es.orders.state}:</strong> {requester.requester_state}</p>
          {lines.map((line) => (
            <div key={line.donation_item_id} className="border-b border-border pb-3 last:border-0 last:pb-0">
              <DonationItemPreview
                description={line.description}
                presentation={line.presentation}
                unit_of_measurement={line.unit_of_measurement}
                subcategory={line.subcategory}
                category={line.category}
                status={line.status}
                quantity={line.available}
              />
              <p className="mt-1 text-xs text-muted">
                {es.orders.requested}: {line.requested_quantity}
              </p>
            </div>
          ))}
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? es.app.loading : es.orders.submit}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
