"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureUserProfile } from "@/lib/ensure-profile";
import { inferCategory, canCreateSlots } from "@/lib/permissions";
import { buildDonationTaxonomy, mergeTaxonomyEntry, type DonationTaxonomy } from "@/lib/donation-taxonomy";
import { filterSlots, hasExactSlotMatch } from "@/lib/slot-search";
import { createSlot } from "@/lib/slot-create";
import { useUserProfile } from "@/contexts/user-profile-context";
import { es } from "@/locales/es";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn, capitalizeWords, normalizeText } from "@/lib/utils";
import { DonationItemPreview } from "@/components/donation-item-preview";
import { StepProgress } from "@/components/step-progress";
import { SlotCardButton } from "@/components/slot-card";
import { Badge } from "@/components/ui/badge";
import type { Slot, DonationItem } from "@/types/database";
import { Pencil, Trash2, X } from "lucide-react";

const selectClassName =
  "h-11 w-full rounded-lg border border-border bg-surface-1 px-3 text-sm capitalize";

interface DonationFormState {
  category: string;
  subcategory: string;
  description: string;
  presentation: string;
  quantity: number;
  unit_of_measurement: string;
  notes: string;
}

const emptyForm = (): DonationFormState => ({
  category: "",
  subcategory: "",
  description: "",
  presentation: "",
  quantity: 1,
  unit_of_measurement: "",
  notes: "",
});

function matchesExistingItem(item: DonationItem, form: DonationFormState) {
  return (
    normalizeText(form.category) === normalizeText(item.category) &&
    normalizeText(form.description) === normalizeText(item.description) &&
    normalizeText(form.presentation) === normalizeText(item.presentation ?? "") &&
    normalizeText(form.subcategory) === normalizeText(item.subcategory ?? "") &&
    normalizeText(form.unit_of_measurement) === normalizeText(item.unit_of_measurement ?? "")
  );
}

const SUBCATEGORY_OPTION_SEP = "||";
function subcategoryOptionValue(category: string, subcategory: string) {
  return `${category}${SUBCATEGORY_OPTION_SEP}${subcategory}`;
}
function parseSubcategoryOptionValue(value: string) {
  const [category, subcategory] = value.split(SUBCATEGORY_OPTION_SEP);
  return { category, subcategory };
}

function SlotBadge({ number }: { number: string }) {
  return (
    <div className="rounded-xl border-2 border-foreground/80 bg-surface-2 px-4 py-3 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {es.slots.selectedSlot}
      </p>
      <p className="text-2xl font-bold tracking-tight">
        {es.slots.slotLabel.replace("{number}", number)}
      </p>
    </div>
  );
}

function SlotHeader({ number, onChangeSlot }: { number: string; onChangeSlot: () => void }) {
  return (
    <div className="space-y-2">
      <SlotBadge number={number} />
      <Button type="button" variant="ghost" size="sm" className="w-full text-muted" onClick={onChangeSlot}>
        {es.inventory.changeSlot}
      </Button>
    </div>
  );
}

interface PendingItem {
  id: string;
  subcategory: string | null;
  category: string;
  description: string;
  presentation: string;
  quantity: number;
  unit_of_measurement: string;
  notes: string;
  existingItemId?: string;
}

function PendingItemRow({
  item,
  onEdit,
  onRemove,
  compact = false,
}: {
  item: PendingItem;
  onEdit: () => void;
  onRemove: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2",
        !compact && "border-b border-border pb-3 last:border-0 last:pb-0"
      )}
    >
      <div className="min-w-0 flex-1">
        <DonationItemPreview
          description={item.description}
          presentation={item.presentation}
          unit_of_measurement={item.unit_of_measurement}
          subcategory={item.subcategory}
          category={item.category}
          quantity={item.quantity}
        />
      </div>
      <div className="flex shrink-0 gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onEdit}
          aria-label={es.inventory.editItem}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-red-600 hover:text-red-700"
          onClick={onRemove}
          aria-label={es.inventory.removeItem}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
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
  const [taxonomy, setTaxonomy] = useState<DonationTaxonomy>({
    categories: [],
    subcategoriesByCategory: {},
  });
  const [form, setForm] = useState<DonationFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [creatingSlot, setCreatingSlot] = useState(false);
  const [error, setError] = useState("");
  const [exitDialogOpen, setExitDialogOpen] = useState(false);

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
    async function loadTaxonomy() {
      const supabase = createClient();
      const { data } = await supabase
        .from("donation_items")
        .select("category, subcategory")
        .is("deleted_at", null);
      setTaxonomy(buildDonationTaxonomy(data ?? []));
    }
    loadTaxonomy();
  }, []);

  const subcategoryOptions = form.category
    ? (taxonomy.subcategoriesByCategory[form.category] ?? [])
    : [];

  const selectedSubcategoryKey =
    form.category &&
    form.subcategory &&
    subcategoryOptions.includes(form.subcategory)
      ? subcategoryOptionValue(form.category, form.subcategory)
      : "";

  function updateForm(patch: Partial<DonationFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function handleTextBlur(field: "category" | "subcategory" | "description" | "presentation" | "unit_of_measurement") {
    updateForm({ [field]: capitalizeWords(form[field]) });
  }

  function handleCategoryChange(category: string) {
    const subcategories = taxonomy.subcategoriesByCategory[category] ?? [];
    updateForm({
      category,
      subcategory: subcategories.includes(form.subcategory) ? form.subcategory : "",
    });
  }

  function handleSubcategorySelect(value: string) {
    if (!value) return;
    if (value.includes(SUBCATEGORY_OPTION_SEP)) {
      const { category, subcategory } = parseSubcategoryOptionValue(value);
      updateForm({ category, subcategory });
      return;
    }
    updateForm({ subcategory: value });
  }

  function fillFormFromItem(item: DonationItem) {
    setSelectedItem(item);
    setForm({
      category: item.category,
      subcategory: item.subcategory ?? "",
      description: item.description,
      presentation: item.presentation ?? "",
      quantity: 1,
      unit_of_measurement: item.unit_of_measurement ?? "",
      notes: "",
    });
    setItemSearch(item.description);
  }

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
  const canCreate = profile ? canCreateSlots(profile.role) : false;
  const showCreateSlot =
    slotSearch.trim() && !hasExactSlotMatch(slots, slotSearch) && canCreate;

  const isExistingMatch = selectedItem ? matchesExistingItem(selectedItem, form) : false;

  async function handleCreateSlot() {
    const number = slotSearch.trim();
    if (!number) return;
    setCreatingSlot(true);
    const supabase = createClient();
    const { slot, error: createError } = await createSlot(supabase, number);
    setCreatingSlot(false);
    if (createError || !slot) return;
    setSlots((prev) => [...prev, slot]);
    setSelectedSlot(slot);
    setStep(2);
    showToast(es.slots.created_success);
  }

  function resetItemForm() {
    setSelectedItem(null);
    setItemSearch("");
    setForm(emptyForm());
    setError("");
  }

  function buildPendingItemFromForm():
    | { ok: true; item: PendingItem }
    | { ok: false; error: string } {
    if (!selectedSlot) {
      return { ok: false, error: es.app.error };
    }

    const normalized = {
      category: form.category.trim() || inferCategory(form.subcategory),
      subcategory: form.subcategory.trim() || null,
      description: form.description.trim(),
      presentation: form.presentation.trim(),
      quantity: form.quantity,
      unit_of_measurement: form.unit_of_measurement.trim(),
      notes: form.notes,
    };

    if (!normalized.category) {
      return { ok: false, error: es.inventory.categoryRequired };
    }

    if (!normalized.description) {
      return { ok: false, error: es.app.error };
    }

    const useExisting =
      selectedItem &&
      matchesExistingItem(selectedItem, {
        ...form,
        ...normalized,
        subcategory: normalized.subcategory ?? "",
      });

    return {
      ok: true,
      item: {
        id: crypto.randomUUID(),
        subcategory: normalized.subcategory,
        category: normalized.category,
        description: normalized.description,
        presentation: normalized.presentation,
        quantity: normalized.quantity,
        unit_of_measurement: normalized.unit_of_measurement,
        notes: normalized.notes,
        existingItemId: useExisting ? selectedItem.id : undefined,
      },
    };
  }

  function formHasItemDraft() {
    return Boolean(
      form.category.trim() ||
        form.subcategory.trim() ||
        form.description.trim() ||
        form.presentation.trim() ||
        form.unit_of_measurement.trim()
    );
  }

  function handleAddItem() {
    const result = buildPendingItemFromForm();
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPendingItems((prev) => [...prev, result.item]);
    setTaxonomy((prev) => mergeTaxonomyEntry(prev, result.item.category, result.item.subcategory));
    resetItemForm();
  }

  function handleGoToReview() {
    if (formHasItemDraft()) {
      const result = buildPendingItemFromForm();
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setPendingItems((prev) => [...prev, result.item]);
      setTaxonomy((prev) => mergeTaxonomyEntry(prev, result.item.category, result.item.subcategory));
      resetItemForm();
      setStep(3);
      return;
    }

    if (pendingItems.length === 0) {
      setError(es.app.error);
      return;
    }

    setError("");
    setStep(3);
  }

  const canAddFromForm = form.category.trim() !== "" && form.description.trim() !== "";
  const canReview = canAddFromForm || pendingItems.length > 0;

  const hasUnsavedProgress =
    pendingItems.length > 0 || formHasItemDraft() || step > 1;

  function exitDonation() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/inventory");
    }
  }

  function handleCloseFlow() {
    if (hasUnsavedProgress) {
      setExitDialogOpen(true);
      return;
    }
    exitDonation();
  }

  function handleChangeSlot() {
    setStep(1);
  }

  function handleEditPending(id: string) {
    const item = pendingItems.find((p) => p.id === id);
    if (!item) return;

    setForm({
      category: item.category,
      subcategory: item.subcategory ?? "",
      description: item.description,
      presentation: item.presentation,
      quantity: item.quantity,
      unit_of_measurement: item.unit_of_measurement,
      notes: item.notes,
    });
    setItemSearch(item.description);
    setSelectedItem(null);
    setPendingItems((prev) => prev.filter((p) => p.id !== id));
    setError("");
    setStep(2);
  }

  function handleRemovePending(id: string) {
    const next = pendingItems.filter((p) => p.id !== id);
    setPendingItems(next);
    if (next.length === 0 && step === 3) {
      setStep(2);
    }
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
            category: item.category,
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
    { label: es.inventory.stepSlot },
    { label: es.inventory.stepItems },
    { label: es.inventory.stepReview },
  ];

  const totalQuantity = pendingItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-0.5 shrink-0"
          onClick={handleCloseFlow}
          aria-label={es.inventory.closeDonation}
        >
          <X className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <StepProgress
            steps={steps}
            currentStep={step}
            stepLabel={es.inventory.stepOf
              .replace("{current}", String(step))
              .replace("{total}", String(steps.length))}
          />
        </div>
      </div>

      <Dialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{es.inventory.exitDonationTitle}</DialogTitle>
            <DialogDescription>{es.inventory.exitDonationDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExitDialogOpen(false)}>
              {es.app.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setExitDialogOpen(false);
                exitDonation();
              }}
            >
              {es.inventory.exitDonationConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">{es.inventory.selectSlot}</h2>
          {pendingItems.length > 0 && (
            <p className="text-sm text-muted">{es.inventory.changeSlotHint}</p>
          )}
          <p className="text-sm text-muted">{es.slots.searchHint}</p>
          <Input
            placeholder={es.slots.searchPlaceholder}
            value={slotSearch}
            onChange={(e) => setSlotSearch(e.target.value)}
          />
          {showCreateSlot && (
            <Button className="w-full" onClick={handleCreateSlot} disabled={creatingSlot}>
              {es.slots.createFromSearch.replace("{number}", slotSearch.trim())}
            </Button>
          )}
          {filteredSlots.length === 0 && slotSearch.trim() && !showCreateSlot ? (
            <p className="text-sm text-muted">{es.app.noResults}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {filteredSlots.map((slot) => (
                <SlotCardButton
                  key={slot.id}
                  number={slot.number}
                  status={slot.status}
                  onClick={() => {
                    setSelectedSlot(slot);
                    setStep(2);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-3">
            <h2 className="text-2xl font-bold">{es.inventory.addDonation}</h2>
            {selectedSlot && (
              <SlotHeader number={selectedSlot.number} onChangeSlot={handleChangeSlot} />
            )}
          </div>

          {pendingItems.length > 0 && (
            <Card className="border-border bg-surface-1">
              <CardHeader>
                <CardTitle className="text-base">
                  {es.inventory.addedItems.replace("{count}", String(pendingItems.length))}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingItems.map((item) => (
                  <PendingItemRow
                    key={item.id}
                    item={item}
                    onEdit={() => handleEditPending(item.id)}
                    onRemove={() => handleRemovePending(item.id)}
                  />
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
                  className="capitalize"
                />
                {existingItems.length > 0 && !selectedItem && (
                  <div className="space-y-1 rounded-lg border border-border p-2">
                    {existingItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="block w-full rounded p-2 text-left hover:bg-surface-2"
                        onClick={() => fillFormFromItem(item)}
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
                  </div>
                )}
              </div>

              {selectedItem && (
                <p
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    isExistingMatch
                      ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
                      : "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200"
                  )}
                >
                  {isExistingMatch ? es.inventory.existingItemHint : es.inventory.variantHint}
                </p>
              )}

              <div className="space-y-3 rounded-lg border border-border bg-surface-2/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {es.inventory.category}
                </p>
                <div className="space-y-2">
                  <select
                    className={selectClassName}
                    value={taxonomy.categories.includes(form.category) ? form.category : ""}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                  >
                    <option value="">{es.inventory.selectCategory}</option>
                    {taxonomy.categories.map((category) => (
                      <option key={category} value={category}>
                        {capitalizeWords(category)}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={form.category}
                    onChange={(e) => updateForm({ category: e.target.value })}
                    onBlur={() => handleTextBlur("category")}
                    placeholder={es.inventory.customCategory}
                    className="capitalize"
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {es.inventory.subcategory}{" "}
                  <span className="font-normal normal-case">({es.inventory.subcategoryOptional})</span>
                </p>
                <div className="space-y-2">
                  <select
                    className={selectClassName}
                    value={selectedSubcategoryKey}
                    onChange={(e) => handleSubcategorySelect(e.target.value)}
                  >
                    <option value="">{es.inventory.selectSubcategory}</option>
                    {form.category ? (
                      subcategoryOptions.map((subcategory) => (
                        <option
                          key={subcategory}
                          value={subcategoryOptionValue(form.category, subcategory)}
                        >
                          {capitalizeWords(subcategory)}
                        </option>
                      ))
                    ) : (
                      taxonomy.categories.map((category) => (
                        <optgroup key={category} label={capitalizeWords(category)}>
                          {(taxonomy.subcategoriesByCategory[category] ?? []).map((subcategory) => (
                            <option
                              key={subcategoryOptionValue(category, subcategory)}
                              value={subcategoryOptionValue(category, subcategory)}
                            >
                              {capitalizeWords(subcategory)}
                            </option>
                          ))}
                        </optgroup>
                      ))
                    )}
                  </select>
                  <Input
                    value={form.subcategory}
                    onChange={(e) => updateForm({ subcategory: e.target.value })}
                    onBlur={() => handleTextBlur("subcategory")}
                    placeholder={es.inventory.customSubcategory}
                    className="capitalize"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{es.inventory.description_label}</Label>
                <Input
                  value={form.description}
                  onChange={(e) => updateForm({ description: e.target.value })}
                  onBlur={() => handleTextBlur("description")}
                  className="capitalize"
                />
              </div>
              <div className="space-y-2">
                <Label>{es.inventory.presentation}</Label>
                <Input
                  value={form.presentation}
                  onChange={(e) => updateForm({ presentation: e.target.value })}
                  onBlur={() => handleTextBlur("presentation")}
                  className="capitalize"
                />
              </div>
              <div className="space-y-2">
                <Label>{es.inventory.unit}</Label>
                <Input
                  value={form.unit_of_measurement}
                  onChange={(e) => updateForm({ unit_of_measurement: e.target.value })}
                  onBlur={() => handleTextBlur("unit_of_measurement")}
                  className="capitalize"
                />
              </div>

              <div className="space-y-2">
                <Label>{es.inventory.quantity}</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) =>
                    updateForm({ quantity: Math.max(1, parseInt(e.target.value) || 1) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{es.inventory.notes}</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => updateForm({ notes: e.target.value })}
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-xs text-muted">{es.inventory.donationActionsHint}</p>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    className="w-full"
                    onClick={handleGoToReview}
                    disabled={!canReview}
                  >
                    {es.inventory.review}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-muted"
                    onClick={handleAddItem}
                    disabled={!canAddFromForm}
                  >
                    {pendingItems.length > 0 ? es.inventory.addAnother : es.inventory.addToList}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">{es.inventory.review}</h2>
              <p className="mt-1 text-sm text-muted">{es.inventory.reviewSummary}</p>
            </div>
            <Badge variant="secondary">{pendingItems.length}</Badge>
          </div>

          {selectedSlot && (
            <Card className="border-border bg-surface-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{es.inventory.reviewDestination}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-3xl font-bold tracking-tight">{selectedSlot.number}</p>
                    <p className="text-sm text-muted">
                      {es.slots.statuses[selectedSlot.status]}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleChangeSlot}>
                    {es.inventory.changeSlot}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border bg-surface-1">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{es.inventory.reviewItemsTitle}</CardTitle>
                <span className="text-xs text-muted">
                  {es.inventory.totalQuantity.replace("{count}", String(totalQuantity))}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-border bg-surface-0/50 p-3">
                  <PendingItemRow
                    item={item}
                    onEdit={() => handleEditPending(item.id)}
                    onRemove={() => handleRemovePending(item.id)}
                    compact
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
              {es.app.back}
            </Button>
            <Button className="flex-1" onClick={handleFinish} disabled={saving}>
              {saving ? es.app.loading : es.inventory.finishRegistration}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
