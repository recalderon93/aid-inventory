"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureUserProfile } from "@/lib/ensure-profile";
import { inferCategory, canCreateSlots } from "@/lib/permissions";
import { filterSlots, hasExactSlotMatch } from "@/lib/slot-search";
import { useUserProfile } from "@/contexts/user-profile-context";
import { es } from "@/locales/es";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { Slot, DonationItem } from "@/types/database";

interface PendingItem {
  subcategory: string;
  description: string;
  presentation: string;
  quantity: number;
  unit_of_measurement: string;
  notes: string;
  existingItemId?: string;
}

export function AddDonationForm({ preselectedSlotId }: { preselectedSlotId?: string | null }) {
  const router = useRouter();
  const { profile } = useUserProfile();
  const { showToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(preselectedSlotId ? 2 : 1);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotSearch, setSlotSearch] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [existingItems, setExistingItems] = useState<DonationItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<DonationItem | null>(null);
  const [form, setForm] = useState({
    subcategory: "",
    description: "",
    presentation: "",
    quantity: 1,
    unit_of_measurement: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [creatingSlot, setCreatingSlot] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSlots() {
      const supabase = createClient();
      const { data } = await supabase
        .from("slots")
        .select("*")
        .is("deleted_at", null)
        .order("number");
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

  const filteredSlots = filterSlots(slots, slotSearch);
  const showCreateSlot =
    slotSearch.trim() &&
    !hasExactSlotMatch(slots, slotSearch) &&
    profile &&
    canCreateSlots(profile.role);

  async function handleCreateSlot() {
    const number = slotSearch.trim();
    if (!number) return;
    setCreatingSlot(true);
    const supabase = createClient();
    const { data, error: createError } = await supabase
      .from("slots")
      .insert({ number, name: number, status: "active" })
      .select()
      .single();
    setCreatingSlot(false);
    if (createError || !data) return;
    setSlots((prev) => [...prev, data]);
    setSelectedSlot(data);
    setStep(2);
    showToast(es.slots.created_success);
  }

  function handleAddItem() {
    if (!selectedSlot) return;
    const item: PendingItem = selectedItem
      ? {
          subcategory: selectedItem.subcategory ?? "",
          description: selectedItem.description,
          presentation: selectedItem.presentation ?? "",
          quantity: form.quantity,
          unit_of_measurement: selectedItem.unit_of_measurement ?? "",
          notes: form.notes,
          existingItemId: selectedItem.id,
        }
      : {
          subcategory: form.subcategory.trim(),
          description: form.description.trim(),
          presentation: form.presentation.trim(),
          quantity: form.quantity,
          unit_of_measurement: form.unit_of_measurement.trim(),
          notes: form.notes,
        };

    if (!item.description && !item.existingItemId) {
      setError(es.app.error);
      return;
    }

    setPendingItems((prev) => [...prev, item]);
    setSelectedItem(null);
    setItemSearch("");
    setForm({
      subcategory: "",
      description: "",
      presentation: "",
      quantity: 1,
      unit_of_measurement: "",
      notes: "",
    });
    setError("");
  }

  async function handleFinish() {
    if (!selectedSlot || pendingItems.length === 0) return;
    setSaving(true);
    setError("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError(es.auth.loginError);
      setSaving(false);
      return;
    }

    const profileResult = await ensureUserProfile(supabase, user);
    if (!profileResult.ok) {
      setError(es.app.profileSetupError);
      setSaving(false);
      return;
    }

    for (const item of pendingItems) {
      let donationItemId = item.existingItemId;

      if (!donationItemId) {
        const { data: newItem, error: itemError } = await supabase
          .from("donation_items")
          .insert({
            category: inferCategory(item.subcategory),
            subcategory: item.subcategory,
            description: item.description,
            presentation: item.presentation || null,
            unit_of_measurement: item.unit_of_measurement || null,
            status: "active",
          })
          .select("id")
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
        .select("id, quantity")
        .eq("slot_id", selectedSlot.id)
        .eq("donation_item_id", donationItemId)
        .maybeSingle();

      const newQty = (existingInv?.quantity ?? 0) + item.quantity;

      const invError = existingInv
        ? (await supabase.from("inventory").update({ quantity: newQty }).eq("id", existingInv.id)).error
        : (
            await supabase.from("inventory").insert({
              slot_id: selectedSlot.id,
              donation_item_id: donationItemId,
              quantity: item.quantity,
            })
          ).error;

      if (invError) {
        setError(es.app.error);
        setSaving(false);
        return;
      }

      await supabase.from("inventory_transactions").insert({
        type: "inbound",
        donation_item_id: donationItemId,
        to_slot_id: selectedSlot.id,
        quantity: item.quantity,
        created_by_user_id: user.id,
        notes: item.notes || "Donation registered",
      });
    }

    setSaving(false);
    showToast(es.inventory.registered_success);
    router.push(`/slots/${selectedSlot.id}`);
  }

  const steps = [
    { n: 1, label: es.inventory.stepSlot },
    { n: 2, label: es.inventory.stepItems },
    { n: 3, label: es.inventory.stepReview },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {steps.map((s) => (
          <div
            key={s.n}
            className={cn(
              "flex-1 rounded-lg border px-2 py-2 text-center text-xs",
              step === s.n ? "border-foreground bg-surface-2 font-medium" : "border-border text-muted"
            )}
          >
            {s.label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">{es.inventory.selectSlot}</h2>
          <p className="text-sm text-muted">{es.slots.searchHint}</p>
          <Input
            placeholder={es.slots.searchPlaceholder}
            value={slotSearch}
            onChange={(e) => setSlotSearch(e.target.value)}
          />
          {showCreateSlot && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleCreateSlot}
              disabled={creatingSlot}
            >
              {es.slots.createFromSearch.replace("{number}", slotSearch.trim())}
            </Button>
          )}
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
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{es.inventory.addDonation}</h2>
            <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-medium">
              {es.slots.title} {selectedSlot?.number}
            </span>
          </div>

          {pendingItems.length > 0 && (
            <Card className="border-border bg-surface-1">
              <CardHeader>
                <CardTitle className="text-base">
                  {pendingItems.length} artículo(s) agregado(s)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingItems.map((item, i) => (
                  <div key={i} className="text-sm">
                    {item.description} × {item.quantity}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-border bg-surface-1">
            <CardContent className="space-y-4 p-4">
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
                  <div className="space-y-1 rounded-lg border border-border p-2">
                    {existingItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="block w-full rounded p-2 text-left hover:bg-surface-2"
                        onClick={() => {
                          setSelectedItem(item);
                          setForm({
                            subcategory: item.subcategory ?? "",
                            description: item.description,
                            presentation: item.presentation ?? "",
                            quantity: 1,
                            unit_of_measurement: item.unit_of_measurement ?? "",
                            notes: "",
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{es.inventory.description_label}</Label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
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
                <Input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: Math.max(1, parseInt(e.target.value) || 1) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{es.inventory.notes}</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleAddItem}>
                  {es.inventory.addAnother}
                </Button>
                {pendingItems.length > 0 && (
                  <Button type="button" variant="secondary" onClick={() => setStep(3)}>
                    {es.inventory.review}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">{es.inventory.review}</h2>
          <p className="text-sm text-muted">
            {es.slots.title} {selectedSlot?.number}
          </p>
          <Card className="border-border bg-surface-1">
            <CardContent className="space-y-3 p-4">
              {pendingItems.map((item, i) => (
                <div key={i} className="flex justify-between border-b border-border pb-2 text-sm">
                  <span>{item.description}</span>
                  <span className="font-medium">× {item.quantity}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              {es.app.back}
            </Button>
            <Button onClick={handleFinish} disabled={saving}>
              {saving ? es.app.loading : es.inventory.finishRegistration}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
