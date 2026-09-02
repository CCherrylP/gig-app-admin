"use client";

import { useState } from "react";
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
  signOut,
} from "@/lib/auth";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    // Two steps, and both have to pass.
    //
    // Supabase says who this is; the API says whether they are staff. Signing in
    // is not authorisation here — every account in the app authenticates against
    // the same project, so a candidate's password works perfectly well and must
    // still not open this dashboard.
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      setIsLoading(false);
      toast.error("Incorrect email or password");
      return;
    }

    try {
      const me = await fetchMe(data.session.access_token);
      cacheUser(me);
      toast.success(`Welcome back${me.name ? `, ${me.name}` : ""}!`);
      router.replace("/dashboard");
    } catch (error) {
      // WHICH failure decides both the sentence and what happens to the
      // session. Only "not staff" is a reason to sign somebody out — an API
      // that is down says nothing about whether this account is allowed in, and
      // throwing away a good session over it means they have to type their
      // password again for a problem on the other end of the wire.
      const reason = error instanceof AuthCheckError ? error.reason : "server";

      if (reason === "not-staff" || reason === "session") await signOut();

      toast.error(authFailureMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

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
        Staff accounts only. There is no sign-up — admin is granted directly on
        the account.
      </FieldDescription>
    </div>
  );
}
