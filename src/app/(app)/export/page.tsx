"use client";

import { useState } from "react";
import { es } from "@/locales/es";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Download } from "lucide-react";

export default function ExportPage() {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function handleExport() {
    setLoading(true);
    const res = await fetch("/api/export");
    if (!res.ok) {
      setLoading(false);
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
    <div className="space-y-4">
      <PageHeader title={es.export.title} description={es.export.description} />
      <Card className="border-border bg-surface-1">
        <CardHeader>
          <CardTitle>Excel (.xlsx)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted">
            Exporta el inventario con columnas compatibles con el formato legacy: CAJA #,
            CLASIFICACION, DESCRIPCION, PRESENTACION, CANT, UND MEDIDA.
          </p>
          <Button onClick={handleExport} disabled={loading}>
            <Download className="h-4 w-4" />
            {loading ? es.app.loading : es.export.download}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
