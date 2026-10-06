"use client";

// The review buddy (T-26): a small robot fixed to the corner of every page. Its mood follows
// GET /api/buddy, or the file just reviewed on /review (the `sift:review` window event).
import { type BuddyFinding, buddyFromFindings, type TBuddyState } from "@sift/shared";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BUDDY_POLL_MS } from "@/lib/config";

type Mood = TBuddyState["mood"];

/** Panel wording, glow colour and a demo line for each mood. Colours are the semantic tokens. */
const MOODS: Record<Mood, { status: string; chip: string; color: string; demo: string }> = {
  happy: { status: "All clear", chip: "Safe", color: "var(--risk-low)", demo: "#42 looks clean" },
  meh: { status: "Mostly fine", chip: "Minor", color: "var(--muted)", demo: "Only nits on #42" },
  worried: {
    status: "Concerned",
    chip: "Caution",
    color: "var(--risk-medium)",
    demo: "Token logged in plain text",
  },
  angry: { status: "Alarmed", chip: "Danger", color: "var(--risk-high)", demo: "SQL injection in checkout" },
  impatient: { status: "Waiting", chip: "Stalled", color: "var(--risk-medium)", demo: "#42 waiting 6h" },
  scanning: { status: "Reviewing", chip: "Busy", color: "var(--accent)", demo: "Reviewing PR #42…" },
  sleepy: { status: "Resting", chip: "Idle", color: "var(--faint)", demo: "Queue empty" },
};
const ORDER: Mood[] = ["happy", "meh", "worried", "angry", "impatient", "scanning", "sleepy"];
const BUBBLE_MS = 6000;
const MOTION: Record<Mood, string> = {
  happy: "buddy-bob",
  meh: "",
  worried: "buddy-bob",
  angry: "buddy-shake",
  impatient: "buddy-tap",
  scanning: "buddy-bob",
  sleepy: "",
};

export function Buddy() {
  const pathname = usePathname();
  const [server, setServer] = useState<TBuddyState | null>(null);
  const [local, setLocal] = useState<TBuddyState | null>(null); // the file reviewed on /review
  const [sim, setSim] = useState<Mood | null>(null);
  const [open, setOpen] = useState(false);
  const [bubble, setBubble] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/buddy", { cache: "no-store" });
      if (res.ok) setServer((await res.json()) as TBuddyState);
    } catch {
      // Offline: keep the last state.
    }
  }, []);

  useEffect(() => {
    load();
    const tick = () => document.visibilityState === "visible" && load();
    const id = setInterval(tick, BUDDY_POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  useEffect(() => {
    const onReview = (e: Event) => setLocal(buddyFromFindings((e as CustomEvent<BuddyFinding[]>).detail));
    window.addEventListener("sift:review", onReview);
    return () => window.removeEventListener("sift:review", onReview);
  }, []);

  // A reviewed file only counts on the page it was reviewed on.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset whenever the route changes
  useEffect(() => setLocal(null), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const real = local ?? server;
  const mood: Mood = sim ?? real?.mood ?? "sleepy";
  const text = sim ? MOODS[sim].demo : (real?.text ?? "Waking up…");
  const look = MOODS[mood];

  // Say something whenever the mood or line changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on a new line only
  useEffect(() => {
    setBubble(true);
    const id = setTimeout(() => setBubble(false), BUBBLE_MS);
    return () => clearTimeout(id);
  }, [mood, text]);

  const tiles: [string, number | undefined, string?][] = [
    [local ? "Files" : "Pending PRs", local ? 1 : real?.pending],
    ["Critical", real?.critical, "var(--risk-high)"],
    ["High", real?.high, "var(--risk-high)"],
    ["Medium", real?.medium, "var(--risk-medium)"],
  ];

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-3 print:hidden">
      {open && (
        <section
          role="dialog"
          aria-label="Sift buddy status"
          className="rise w-[min(20rem,calc(100vw-2rem))] rounded-panel border border-line bg-surface p-4 shadow-panel"
        >
          <header className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span className="size-2 rounded-full" style={{ background: look.color }} aria-hidden />
              Sift buddy
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-control px-2 py-0.5 text-muted hover:bg-surface-2 hover:text-text"
            >
              ✕
            </button>
          </header>

          <div className="mt-3 flex items-center justify-between rounded-control bg-surface-2 px-3 py-2.5">
            <div>
              <p className="text-[11px] tracking-wide text-faint uppercase">Status</p>
              <p className="text-lg font-semibold" style={{ color: look.color }}>
                {look.status}
              </p>
            </div>
            <span
              className="rounded-control border px-2 py-0.5 font-mono text-xs"
              style={{ color: look.color, borderColor: look.color }}
            >
              {look.chip}
            </span>
          </div>
          <p className="mt-2 truncate text-sm text-muted" title={text}>
            {text}
          </p>

          <dl className="mt-3 grid grid-cols-2 gap-2">
            {tiles.map(([label, n, color]) => (
              <div key={label} className="rounded-control border border-line px-3 py-2">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="font-mono text-base" style={n ? { color } : undefined}>
                  {n ?? "–"}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 border-t border-line pt-3">
            <p className="text-xs text-muted">Simulate mood (demo)</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ORDER.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={sim === m}
                  onClick={() => setSim(sim === m ? null : m)}
                  className="flex items-center gap-1.5 rounded-control border border-line px-2 py-1 font-mono text-[11px] text-muted hover:text-text aria-pressed:bg-surface-2 aria-pressed:text-text"
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: MOODS[m].color }}
                    aria-hidden
                  />
                  {MOODS[m].chip}
                </button>
              ))}
            </div>
            {sim && (
              <button
                type="button"
                onClick={() => setSim(null)}
                className="mt-2 text-xs text-accent hover:underline"
              >
                Back to live mood
              </button>
            )}
          </div>
        </section>
      )}

      <div className="flex items-end gap-2">
        {bubble && !open && (
          <p
            role="status"
            className="rise mb-6 max-w-52 rounded-panel border border-line bg-surface px-3 py-1.5 text-xs shadow-panel"
          >
            {text}
          </p>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          onMouseEnter={() => setBubble(true)}
          aria-expanded={open}
          aria-label={`Sift buddy: ${look.status}. ${text}`}
          className="rounded-full"
        >
          <Robot mood={mood} color={look.color} />
        </button>
      </div>
    </div>
  );
}

/** Round helmet, dark visor, glowing eyes. Mood changes the eyes, the glow and the motion. */
function Robot({ mood, color }: { mood: Mood; color: string }) {
  return (
    <svg
      viewBox="0 0 80 88"
      className={`size-20 drop-shadow-lg ${MOTION[mood]}`}
      style={{ ["--glow" as string]: color }}
      aria-hidden
    >
      {mood === "angry" && (
        <g className="buddy-steam" fill="var(--faint)">
          <circle cx="16" cy="10" r="4" />
          <circle cx="64" cy="8" r="3" />
        </g>
      )}
      {mood === "sleepy" && (
        <text x="60" y="14" className="buddy-z" fill="var(--faint)" fontSize="12" fontFamily="monospace">
          z
        </text>
      )}
      {/* ear pods */}
      <rect x="4" y="30" width="10" height="20" rx="5" fill="#cfd6e2" />
      <rect x="66" y="30" width="10" height="20" rx="5" fill="#cfd6e2" />
      {/* body */}
      <path d="M22 70 Q40 62 58 70 L56 86 H24 Z" fill="#e9eef5" />
      <circle cx="40" cy="77" r="3.5" fill="var(--glow)" className="buddy-pulse" />
      {/* helmet + visor */}
      <circle cx="40" cy="40" r="30" fill="#f4f6fa" stroke="#cfd6e2" strokeWidth="1.5" />
      <rect x="18" y="26" width="44" height="28" rx="14" fill="#14161d" />
      <rect x="18" y="26" width="44" height="28" rx="14" fill="var(--glow)" opacity="0.12" />
      <g
        stroke="var(--glow)"
        fill="var(--glow)"
        strokeWidth="3"
        strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 3px var(--glow))" }}
      >
        <Eyes mood={mood} />
      </g>
    </svg>
  );
}

function Eyes({ mood }: { mood: Mood }) {
  switch (mood) {
    case "happy":
      return <path d="M27 42 Q31 36 35 42 M45 42 Q49 36 53 42" fill="none" />;
    case "meh":
      return <path d="M27 40 H35 M45 40 H53" />;
    case "sleepy":
      return <path d="M27 39 Q31 43 35 39 M45 39 Q49 43 53 39" fill="none" />;
    case "angry":
      return (
        <>
          <path d="M26 33 L35 37 M54 33 L45 37" />
          <circle cx="31" cy="42" r="2.6" stroke="none" />
          <circle cx="49" cy="42" r="2.6" stroke="none" />
        </>
      );
    case "worried":
      return (
        <>
          <path d="M27 35 L34 33 M53 35 L46 33" strokeWidth="2" />
          <circle cx="31" cy="41" r="3" stroke="none" />
          <circle cx="49" cy="41" r="3" stroke="none" />
        </>
      );
    case "scanning":
      return (
        <g className="buddy-scan" stroke="none">
          <circle cx="31" cy="40" r="3.2" />
          <circle cx="49" cy="40" r="3.2" />
        </g>
      );
    case "impatient":
      return (
        <g stroke="none">
          <rect x="28" y="38" width="7" height="4" rx="2" />
          <rect x="45" y="38" width="7" height="4" rx="2" />
        </g>
      );
  }
}
