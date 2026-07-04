"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { es } from "@/locales/es";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Package, Boxes, ClipboardList, ArrowLeftRight, Download, LogOut } from "lucide-react";

const navItems = [
  { href: "/slots", label: es.nav.slots, icon: Boxes },
  { href: "/inventory", label: es.nav.inventory, icon: Package },
  { href: "/orders", label: es.nav.orders, icon: ClipboardList },
  { href: "/transactions", label: es.nav.transactions, icon: ArrowLeftRight },
  { href: "/export", label: es.nav.export, icon: Download },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-lg font-semibold">{es.app.name}</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            {es.auth.logout}
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 p-4 pb-24">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex max-w-3xl justify-around px-2 py-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs",
                  active ? "text-neutral-900 dark:text-white" : "text-neutral-500"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
