"use server";

import { redirect } from "next/navigation";
import { Credentials, DUMMY_HASH, hashPassword, safeNext, verifyPassword } from "@/lib/auth";
import { MAX_ACCOUNTS } from "@/lib/config";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";

export type AuthState = { error?: string; email?: string } | undefined;

const WRONG = "Wrong email or password.";
const DOWN = "Couldn't reach the database. Try again in a moment.";

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = Credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  const email = String(form.get("email") ?? "");
  if (!parsed.success) return { error: WRONG, email };
  try {
    const user = await db().user.findUnique({ where: { email: parsed.data.email } });
    // Always run scrypt so response time doesn't reveal which emails exist.
    const ok = verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user?.passwordHash || !ok) return { error: WRONG, email };
    await createSession(user.id);
  } catch (err) {
    console.error("login failed:", err instanceof Error ? err.message : String(err));
    return { error: DOWN, email };
  }
  redirect(safeNext(form.get("next")));
}

export async function signup(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = Credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  const email = String(form.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details.", email };
  try {
    const prisma = db();
    if ((await prisma.user.count()) >= MAX_ACCOUNTS)
      return { error: "Sign-up is closed: this Sift has all the accounts it allows.", email };
    if (await prisma.user.findUnique({ where: { email: parsed.data.email } }))
      return { error: "That email already has an account. Log in instead.", email };
    const user = await prisma.user.create({
      data: { email: parsed.data.email, passwordHash: hashPassword(parsed.data.password) },
    });
    await createSession(user.id);
  } catch (err) {
    console.error("signup failed:", err instanceof Error ? err.message : String(err));
    return { error: DOWN, email };
  }
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await destroySession();
  redirect("/");
}
