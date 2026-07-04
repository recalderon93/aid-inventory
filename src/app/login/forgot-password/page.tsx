"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { es } from "@/locales/es";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    setLoading(false);
    if (resetError) {
      setError(es.app.error);
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0 p-4">
      <Card className="w-full max-w-md border-border bg-surface-1">
        <CardContent className="p-6">
          <div className="mb-6 flex justify-center">
            <Logo size="sm" />
          </div>
          <h1 className="mb-2 text-xl font-semibold">{es.auth.resetPassword}</h1>

          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-muted">{es.auth.resetSent}</p>
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  {es.auth.backToLogin}
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{es.auth.email}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? es.app.loading : es.auth.sendResetLink}
              </Button>
              <Link href="/login" className="block text-center text-sm text-muted hover:underline">
                {es.auth.backToLogin}
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
