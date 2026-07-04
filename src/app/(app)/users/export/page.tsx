"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { es } from "@/locales/es";
import { useUserProfile } from "@/contexts/user-profile-context";
import { canManageUsers } from "@/lib/permissions";
import { PageHeader } from "@/components/page-header";
import { ExportInventoryCard } from "@/components/export-inventory-card";
import { Button } from "@/components/ui/button";

export default function AdminExportPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useUserProfile();

  useEffect(() => {
    if (profileLoading) return;
    if (!profile || !canManageUsers(profile.role)) {
      router.replace("/slots");
    }
  }, [profile, profileLoading, router]);

  if (profileLoading || !profile || !canManageUsers(profile.role)) {
    return null;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={es.export.title}
        description={es.export.adminDescription}
        action={
          <Link href="/users">
            <Button variant="outline" size="sm">
              {es.app.back}
            </Button>
          </Link>
        }
      />
      <ExportInventoryCard />
    </div>
  );
}
