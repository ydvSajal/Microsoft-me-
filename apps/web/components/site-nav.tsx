// Server-only nav: reads the session, so it lives apart from ui.tsx (which client components import).
import Link from "next/link";
import { logout } from "@/app/login/actions";
import { displayName, getUser } from "@/lib/session";
import { NavBar, type NavHref } from "./ui";

export async function SiteNav({ current }: { current?: NavHref }) {
  const user = await getUser();
  const account = user ? (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-control px-2 py-1.5 font-mono text-xs text-muted hover:text-text">
        {displayName(user)}
      </summary>
      <div className="absolute right-0 mt-2 w-40 rounded-panel border border-line bg-surface p-1 shadow-panel">
        <Link
          href="/settings"
          className="block rounded-control px-3 py-1.5 text-muted hover:bg-surface-2 hover:text-text"
        >
          Settings
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="w-full rounded-control px-3 py-1.5 text-left text-muted hover:bg-surface-2 hover:text-text"
          >
            Log out
          </button>
        </form>
      </div>
    </details>
  ) : (
    <Link href="/login" className="rounded-control px-3 py-1.5 text-muted hover:text-text">
      Log in
    </Link>
  );
  return <NavBar current={current} account={account} />;
}
