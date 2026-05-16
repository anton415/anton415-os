import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { LayoutDashboard } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { authApi, AuthApiError } from "../api";
import type { AuthProvider } from "../api/types";

const providerLabels: Record<string, string> = {
  yandex: "Yandex ID",
  google: "Google",
  github: "GitHub"
};

function describeError(error: unknown): string {
  if (error instanceof AuthApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Не удалось выполнить запрос";
}

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, list] = await Promise.all([authApi.me(), authApi.providers()]);
        if (cancelled) return;
        setProviders(list);
        if (me.authenticated) {
          navigate("/", { replace: true });
        }
      } catch (err) {
        if (!cancelled) {
          setError(describeError(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const oauthProviders = providers.filter((p) => p.kind !== "email");

  const handleEmailLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(undefined);
    try {
      await authApi.startEmail(email.trim());
      setEmailSent(true);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuth = (providerId: string) => {
    window.location.href = authApi.oauthStartUrl(providerId, "/");
  };

  return (
    <div className="flex h-screen bg-background">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-lg">
            <LayoutDashboard className="size-6" />
          </div>
          <div>
            <h1 className="text-lg">anton-hub</h1>
            <p className="text-xs text-muted-foreground">Личный центр управления</p>
          </div>
        </div>

        <div className="w-full max-w-md">
          <Card>
            <CardContent className="pt-6">
              <form className="space-y-4" onSubmit={handleEmailLogin}>
                <div className="space-y-2">
                  <Label htmlFor="email">Эл. почта</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting || loading}
                  />
                </div>

                {emailSent && (
                  <p className="text-sm text-success">
                    Ссылка для входа отправлена. Проверьте почту.
                  </p>
                )}

                {error && <p className="text-sm text-danger">{error}</p>}

                <Button type="submit" className="w-full" disabled={submitting || loading}>
                  {submitting ? "Отправляем..." : "Отправить ссылку"}
                </Button>

                {oauthProviders.map((provider) => (
                  <Button
                    key={provider.id}
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => handleOAuth(provider.id)}
                    disabled={loading}
                  >
                    {providerLabels[provider.id] ?? provider.name}
                  </Button>
                ))}
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
