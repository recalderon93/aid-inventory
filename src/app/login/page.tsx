"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginAction } from "@/app/login/actions";
import { es } from "@/locales/es";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/logo";

function mapAuthError(message?: string): string {
  if (!message) return es.auth.loginError;
  const normalized = message.toLowerCase();
  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid email or password")
  ) {
    return es.auth.loginError;
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirme su correo electrónico antes de iniciar sesión.";
  }
  return es.auth.accountNotFound;
}

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

    const result = await loginAction(email, password);

    if (!result.ok) {
      if (result.reason === "auth_error") {
        setError(mapAuthError(result.message));
      } else if (result.reason === "no_profile") {
        setError(es.auth.profileNotFound);
      } else if (result.reason === "inactive") {
        setError(es.auth.accountInactive);
      } else {
        setError(es.auth.accountNotFound);
      }
      setLoading(false);
      return;
    }

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
