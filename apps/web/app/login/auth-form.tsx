"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Panel } from "@/components/ui";
import { type AuthState, login, signup } from "./actions";

const input =
  "w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-text placeholder:text-faint focus:border-accent";

const GITHUB_ERRORS: Record<string, string> = {
  state: "GitHub sign-in expired or was tampered with. Try again.",
  github: "GitHub didn't accept the sign-in. Try again.",
  closed: "Sign-up is closed: this Sift has all the accounts it allows.",
  config: "GitHub sign-in isn't configured on this server yet.",
  taken: "That GitHub account is already linked to another Sift account.",
};

export function AuthForm({
  mode,
  next,
  oauthError,
}: {
  mode: "login" | "signup";
  next: string;
  oauthError?: string;
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "login" ? login : signup,
    undefined,
  );
  const error = state?.error ?? (oauthError ? GITHUB_ERRORS[oauthError] : undefined);
  return (
    <Panel className="mx-auto mt-8 w-full max-w-sm p-6">
      <a
        href={`/api/auth/github?next=${encodeURIComponent(next)}`}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-control border border-line bg-surface text-sm font-medium hover:bg-surface-2"
      >
        <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.67.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
        Continue with GitHub
      </a>
      <p className="my-4 text-center text-xs text-faint">or with email</p>
      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm">
          <span className="text-muted">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={state?.email}
            className={`${input} mt-1`}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className={`${input} mt-1`}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-risk-high">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-10 w-full rounded-control bg-accent text-sm font-medium text-accent-ink hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "One moment…" : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        {mode === "login" ? "No account yet? " : "Already have an account? "}
        <Link
          href={`/${mode === "login" ? "signup" : "login"}?next=${encodeURIComponent(next)}`}
          className="text-accent hover:underline"
        >
          {mode === "login" ? "Sign up" : "Log in"}
        </Link>
      </p>
    </Panel>
  );
}
