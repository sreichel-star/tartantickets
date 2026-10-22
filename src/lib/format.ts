// Display helpers. All times are shown in Pittsburgh time.

export const LOW_SEATS_THRESHOLD = 5;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
});

/** e.g. "Fri, Nov 6, 2026 · 7:30 PM" */
export function formatEventDate(iso: string): string {
  const d = new Date(iso);
  return `${dateFormatter.format(d)} · ${timeFormatter.format(d)}`;
}

/** e.g. "$8.00", or "Free" for 0. */
export function formatPrice(priceCents: number): string {
  if (priceCents === 0) return "Free";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(priceCents / 100);
}

/** "Sold out" at 0, "Only 3 left!" at 5 or fewer, otherwise "61 seats left". */
export function formatSeatsRemaining(remaining: number): string {
  if (remaining <= 0) return "Sold out";
  if (remaining <= LOW_SEATS_THRESHOLD) return `Only ${remaining} left!`;
  return `${remaining} seats left`;
}
