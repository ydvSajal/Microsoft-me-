import { expect, it } from "vitest";
import { GET } from "./route";

it("reports db:false instead of failing when the database isn't configured", async () => {
  const saved = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const res = await GET();
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, db: false, commit: "local" });
  if (saved) process.env.DATABASE_URL = saved;
});
