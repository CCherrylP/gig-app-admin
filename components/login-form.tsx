"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { EyeIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  AuthCheckError,
  authFailureMessage,
  cacheUser,
  fetchMe,
  getAccessToken,
  signOut,
  type Me,
} from "@/lib/auth";
import {
  nextMfaStep,
  startEnrolment,
  verifyCode,
  type Enrolment,
} from "@/lib/mfa";

/** Which screen the card shows. Two-factor comes after the password and staff check. */
type Stage =
  | { kind: "password" }
  | { kind: "checking" }
  | { kind: "enrol"; enrolment: Enrolment }
  | { kind: "verify"; factorId: string };

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: "password" });
  const [me, setMe] = useState<Me | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const enterDashboard = (who: Me | null) => {
    toast.success(`Welcome back${who?.name ? `, ${who.name}` : ""}!`);
    router.replace("/dashboard");
  };

  /** Check the account is staff, then send it to the right two-factor screen.
   *  Only "not staff" or a dead session ends the session; a network fault keeps it. */
  const continueSignedIn = async (token: string) => {
    try {
      const who = await fetchMe(token);
      cacheUser(who);
      setMe(who);

      const forced =
        new URLSearchParams(window.location.search).get("mfa") === "1";
      const step = await nextMfaStep(forced);
      if (step.kind === "done") return enterDashboard(who);
      if (step.kind === "verify") return setStage(step);
      setStage({ kind: "enrol", enrolment: await startEnrolment() });
    } catch (error) {
      const reason = error instanceof AuthCheckError ? error.reason : null;
      if (reason === "not-staff" || reason === "session") await signOut();
      toast.error(
        error instanceof AuthCheckError
          ? authFailureMessage(error)
          : "Could not start two-factor login. Try again.",
      );
      setStage({ kind: "password" });
    }
  };

  // Pick up a saved session, unless we were just sent here after a sign-out.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("r") === "1") return;
    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;
      setStage({ kind: "checking" });
      await continueSignedIn(token);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    // Supabase says who this is; the API says whether they are staff.
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      setIsLoading(false);
      toast.error("Incorrect email or password");
      return;
    }

    await continueSignedIn(data.session.access_token);
    setIsLoading(false);
  };

  const handleCode = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (stage.kind !== "enrol" && stage.kind !== "verify") return;

    const factorId =
      stage.kind === "enrol" ? stage.enrolment.factorId : stage.factorId;

    setIsLoading(true);
    const ok = await verifyCode(factorId, code.trim());
    setIsLoading(false);

    if (!ok) {
      setCode("");
      toast.error("Incorrect code. Try again.");
      return;
    }
    enterDashboard(me);
  };

  const useAnotherAccount = async () => {
    await signOut();
    setCode("");
    setPassword("");
    setStage({ kind: "password" });
  };

  if (stage.kind === "checking") {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <p className="text-center text-sm text-muted-foreground">
          Checking your account...
        </p>
      </div>
    );
  }

  if (stage.kind === "enrol" || stage.kind === "verify") {
    const enrolling = stage.kind === "enrol";

    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <Card className="ring-0!">
          <CardHeader className="text-center md:text-left">
            <CardTitle className="text-3xl font-semibold">
              {enrolling ? "Set up two-factor login" : "Enter your code"}
            </CardTitle>
            <CardDescription className="max-w-sm mx-auto md:mx-0">
              {enrolling
                ? "Scan this QR code with an authenticator app, such as Google Authenticator or 1Password. Then enter the 6-digit code it shows."
                : "Open your authenticator app and enter the 6-digit code for AdHoc Admin."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleCode}>
              <FieldGroup>
                {stage.kind === "enrol" && (
                  <Field>
                    {/* Wrapped so Field's *:w-full stretches the div, not the image. */}
                    <div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={stage.enrolment.qrSrc}
                        alt="QR code for your authenticator app"
                        className="mx-auto size-44 rounded-lg bg-white object-contain p-2 md:mx-0"
                      />
                    </div>
                    <FieldDescription>
                      Can&apos;t scan it? Enter this key instead:
                    </FieldDescription>
                    <code className="block break-all rounded-md bg-muted px-3 py-2 font-mono text-sm select-all">
                      {stage.enrolment.secret}
                    </code>
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="code">6-digit code</FieldLabel>
                  <Input
                    id="code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="123456"
                    required
                    autoFocus
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                  />
                </Field>
                <Field className="mt-1">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={isLoading || code.length !== 6}
                  >
                    {isLoading ? "Checking..." : enrolling ? "Turn on" : "Verify"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={useAnotherAccount}
                  >
                    Use another account
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
        <FieldDescription className="px-3 text-center text-sm">
          Lost your authenticator? Ask another admin to reset it.
        </FieldDescription>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="ring-0!">
        <CardHeader className="text-center md:text-left">
          <CardTitle className="text-3xl font-semibold">Welcome back</CardTitle>
          <CardDescription className="max-w-sm mx-auto md:mx-0">
            Sign in to review candidate certificates and confirm the payments
            that credit an employer&apos;s coins.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                    className="pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <HugeiconsIcon
                      icon={showPassword ? ViewOffSlashIcon : EyeIcon}
                      className="size-4"
                    />
                  </button>
                </div>
              </Field>
              <Field className="mt-1">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Loading..." : "Sign in"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-3 text-center text-sm">
        Staff accounts only. There is no sign-up. Admin access is granted
        directly on the account.
      </FieldDescription>
    </div>
  );
}
