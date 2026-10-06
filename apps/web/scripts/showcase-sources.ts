// The files behind the "Try an example" buttons on /review. Small on purpose: a judge reads one in seconds.
// `pnpm --filter web showcase:record` reviews each with the real model and writes lib/showcase/<slug>.json.
export const SHOWCASE_SOURCES = [
  {
    slug: "orders-api",
    label: "Orders API",
    blurb: "An injectable query, a missing await and a swallowed error.",
    filename: "src/orders.ts",
    content: `import { db } from "./db";
import { sendReceipt } from "./mail";

export async function findOrders(customerId: string, status: string) {
  const rows = await db.query("SELECT * FROM orders WHERE customer_id = '" + customerId + "' AND status = '" + status + "'");
  return rows;
}

export async function payOrder(orderId: string) {
  const order = db.get("orders", orderId);
  if (order.total <= 0) throw new Error("nothing to pay");
  await db.update("orders", orderId, { paid: true });
  await sendReceipt(order.email, order.total).catch(() => {});
  return order;
}
`,
  },
  {
    slug: "cart-totals",
    label: "Cart totals",
    blurb: "An off-by-one, a null access and a float-money bug.",
    filename: "src/cart.ts",
    content: `export interface Item {
  sku: string;
  price: number;
  qty: number;
}

export function cartTotal(items: Item[]) {
  let total = 0;
  for (let i = 0; i <= items.length; i++) total += items[i].price * items[i].qty;
  return total;
}

export function applyCoupon(total: number, coupons: Record<string, number>, code?: string) {
  const pct = coupons[code.toUpperCase()];
  return total - total * (pct / 100);
}

export function splitBill(total: number, people: number) {
  return (total / people).toFixed(2);
}
`,
  },
  {
    slug: "format-helpers",
    label: "Clean file",
    blurb: "Nothing to flag. Sift stays quiet when the code is fine.",
    filename: "src/utils/format.ts",
    content: `const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}

export function pluralize(count: number, word: string): string {
  return \`\${count} \${word}\${count === 1 ? "" : "s"}\`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
`,
  },
] as const;
