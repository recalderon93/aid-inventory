"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { inferCategory } from "@/lib/permissions";
import { es } from "@/locales/es";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Slot, DonationItem } from "@/types/database";

function AddDonationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedSlotId = searchParams.get("slotId");

  const [step, setStep] = useState<1 | 2>(preselectedSlotId ? 2 : 1);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotSearch, setSlotSearch] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [existingItems, setExistingItems] = useState<DonationItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<DonationItem | null>(null);
  const [form, setForm] = useState({
    subcategory: "",
    description: "",
    presentation: "",
    quantity: 1,
    unit_of_measurement: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSlots() {
      const supabase = createClient();
      const { data } = await supabase.from("slots").select("*").is("deleted_at", null).order("number");
      setSlots(data ?? []);
      if (preselectedSlotId) {
        const slot = data?.find((s) => s.id === preselectedSlotId) ?? null;
        setSelectedSlot(slot);
      }
    }
    loadSlots();
  }, [preselectedSlotId]);

  useEffect(() => {
    if (itemSearch.length < 2) {
      setExistingItems([]);
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
      setExistingItems(data ?? []);
    }, 300);
    return () => clearTimeout(timer);
  }, [itemSearch]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) return;
    setSaving(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError(es.auth.loginError);
      setSaving(false);
      return;
    }

    let donationItemId = selectedItem?.id;

    if (!donationItemId) {
      const subcategory = form.subcategory.trim();
      const { data: newItem, error: itemError } = await supabase
        .from("donation_items")
        .insert({
          category: inferCategory(subcategory),
          subcategory,
          description: form.description.trim(),
          presentation: form.presentation.trim() || null,
          unit_of_measurement: form.unit_of_measurement.trim() || null,
          status: "active",
        })
        .select()
        .single();

      if (itemError || !newItem) {
        setError(es.app.error);
        setSaving(false);
        return;
      }
      donationItemId = newItem.id;
    }

    const { data: existingInv } = await supabase
      .from("inventory")
      .select("*")
      .eq("slot_id", selectedSlot.id)
      .eq("donation_item_id", donationItemId)
      .maybeSingle();

    const newQty = (existingInv?.quantity ?? 0) + form.quantity;

    const { error: invError } = await supabase.from("inventory").upsert({
      id: existingInv?.id,
      slot_id: selectedSlot.id,
      donation_item_id: donationItemId,
      quantity: newQty,
    }, { onConflict: "slot_id,donation_item_id" });

    if (invError) {
      setError(es.app.error);
      setSaving(false);
      return;
    }

    await supabase.from("inventory_transactions").insert({
      type: "inbound",
      donation_item_id: donationItemId,
      to_slot_id: selectedSlot.id,
      quantity: form.quantity,
      created_by_user_id: user.id,
      notes: "Donation registered",
    });

    setSaving(false);
    router.push(`/slots/${selectedSlot.id}`);
  }

  const filteredSlots = slots.filter((s) => s.number.includes(slotSearch.trim()));

  if (step === 1) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">{es.inventory.selectSlot}</h2>
        <Input
          placeholder={es.slots.searchPlaceholder}
          value={slotSearch}
          onChange={(e) => setSlotSearch(e.target.value)}
        />
        <div className="grid grid-cols-3 gap-2">
          {filteredSlots.map((slot) => (
            <Button
              key={slot.id}
              variant="outline"
              onClick={() => {
                setSelectedSlot(slot);
                setStep(2);
              }}
            >
              {slot.number}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{es.inventory.addDonation}</h2>
        <BadgeSlot number={selectedSlot?.number} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{es.inventory.description}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{es.app.search}</Label>
              <Input
                value={itemSearch}
                onChange={(e) => {
                  setItemSearch(e.target.value);
                  setSelectedItem(null);
                }}
                placeholder={es.inventory.searchPlaceholder}
              />
              {existingItems.length > 0 && !selectedItem && (
                <div className="space-y-1 rounded-lg border p-2">
                  {existingItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="block w-full rounded p-2 text-left hover:bg-neutral-100"
                      onClick={() => {
                        setSelectedItem(item);
                        setForm({
                          subcategory: item.subcategory ?? "",
                          description: item.description,
                          presentation: item.presentation ?? "",
                          quantity: 1,
                          unit_of_measurement: item.unit_of_measurement ?? "",
                        });
                        setItemSearch(item.description);
                      }}
                    >
                      {item.description} — {item.subcategory}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {!selectedItem && (
              <>
                <div className="space-y-2">
                  <Label>{es.inventory.subcategory}</Label>
                  <Input
                    value={form.subcategory}
                    onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{es.inventory.description}</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{es.inventory.presentation}</Label>
                  <Input
                    value={form.presentation}
                    onChange={(e) => setForm({ ...form, presentation: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{es.inventory.unit}</Label>
                  <Input
                    value={form.unit_of_measurement}
                    onChange={(e) => setForm({ ...form, unit_of_measurement: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>{es.inventory.quantity}</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForm({ ...form, quantity: Math.max(1, form.quantity - 1) })}
                >
                  -
                </Button>
                <Input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="text-center"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForm({ ...form, quantity: form.quantity + 1 })}
                >
                  +
                </Button>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? es.app.loading : es.app.save}
              </Button>
              <Link href="/inventory/add">
                <Button type="button" variant="secondary">{es.inventory.addAnother}</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function BadgeSlot({ number }: { number?: string }) {
  if (!number) return null;
  return (
    <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm font-medium">
      {es.slots.title} {number}
    </span>
  );
}

export default function AddDonationPage() {
  return (
    <Suspense fallback={<p>{es.app.loading}</p>}>
      <AddDonationForm />
    </Suspense>
  );
}
