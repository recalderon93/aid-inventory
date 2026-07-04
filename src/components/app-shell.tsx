"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { es } from "@/locales/es";
import { useUserProfile } from "@/contexts/user-profile-context";
import { canRegisterDonations } from "@/lib/permissions";
import { Logo } from "@/components/logo";
import { Avatar, getInitials } from "@/components/ui/avatar";
import { UserMenuSheet } from "@/components/user-menu-sheet";
import { cn } from "@/lib/utils";
import { Package, Boxes, ClipboardList, ArrowLeftRight, Download, Plus } from "lucide-react";

const sideNavItems = [
  { href: "/slots", label: es.nav.slots, icon: Boxes },
  { href: "/inventory", label: es.nav.inventory, icon: Package },
  { href: "/orders", label: es.nav.orders, icon: ClipboardList },
  { href: "/transactions", label: es.nav.transactions, icon: ArrowLeftRight },
  { href: "/export", label: es.nav.export, icon: Download },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile } = useUserProfile();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = profile
    ? getInitials(profile.first_name, profile.last_name, profile.name)
    : "?";

  const leftItems = sideNavItems.slice(0, 2);
  const rightItems = sideNavItems.slice(2);
  const showDonateFab = profile && canRegisterDonations(profile.role);

  return (
    <div className="flex min-h-screen flex-col bg-surface-0">
      <header className="sticky top-0 z-10 border-b border-border bg-surface-1/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Logo size="sm" />
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-full transition-transform active:scale-95"
            aria-label="Abrir menú de usuario"
          >
            <Avatar initials={initials} size="md" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 p-4 pb-28">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-surface-1/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-end justify-around px-2 pb-2 pt-1">
          {leftItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs transition-colors",
                  active ? "text-foreground" : "text-muted"
                )}
              >
                {active && (
                  <span className="absolute -top-1 h-0.5 w-8 rounded-full bg-foreground" />
                )}
                <Icon className="h-5 w-5" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}

          {showDonateFab && (
            <Link
              href="/inventory/add"
              className="relative -mt-5 flex flex-col items-center"
              aria-label={es.nav.donate}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform active:scale-95">
                <Plus className="h-7 w-7" strokeWidth={2.5} />
              </span>
              <span className="mt-1 text-xs font-medium text-foreground">{es.nav.donate}</span>
            </Link>
          )}

          {rightItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs transition-colors",
                  active ? "text-foreground" : "text-muted"
                )}
              >
                {active && (
                  <span className="absolute -top-1 h-0.5 w-8 rounded-full bg-foreground" />
                )}
                <Icon className="h-5 w-5" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <UserMenuSheet open={menuOpen} onOpenChange={setMenuOpen} />
    </div>
  );
}
