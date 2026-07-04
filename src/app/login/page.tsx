"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureUserProfile } from "@/lib/ensure-profile";
import { es } from "@/locales/es";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(es.auth.accountNotFound);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError(es.auth.loginError);
      setLoading(false);
      return;
    }

    const profileResult = await ensureUserProfile(supabase, data.user);
    if (!profileResult.ok) {
      setError(es.auth.accountNotFound);
      setLoading(false);
      return;
    }

    await supabase
      .from("profiles")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", data.user.id);

    router.push("/slots");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-0">
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md border-border bg-surface-1 shadow-sm">
          <CardContent className="p-6">
            <div className="mb-8 flex justify-center">
              <Logo size="md" />
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-[280px] flex-col">
              <div className="flex-1 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{es.auth.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{es.auth.password}</Label>
                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <div className="text-right">
                  <Link
                    href="/login/forgot-password"
                    className="text-sm text-muted underline-offset-4 hover:underline"
                  >
                    {es.auth.forgotPassword}
                  </Link>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>

              <Button type="submit" className="mt-6 w-full transition-transform active:scale-[0.98]" disabled={loading}>
                {loading ? es.app.loading : es.auth.login}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
