"use client";

import { useState } from "react";
import { es } from "@/locales/es";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Download } from "lucide-react";

export function ExportInventoryCard() {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function handleExport() {
    setLoading(true);
    const res = await fetch("/api/export");
    if (!res.ok) {
      setLoading(false);
      showToast(es.app.error);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventario-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setLoading(false);
    showToast(es.export.success);
  }

  return (
    <Card className="border-border bg-surface-1">
      <CardHeader>
        <CardTitle>Excel (.xlsx)</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted">{es.export.description}</p>
        <Button onClick={handleExport} disabled={loading}>
          <Download className="h-4 w-4" />
          {loading ? es.app.loading : es.export.download}
        </Button>
      </CardContent>
    </Card>
  );
}
