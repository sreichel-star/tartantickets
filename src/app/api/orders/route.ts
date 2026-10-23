import { startCheckout } from "@/lib/orders";

// POST /api/orders — start checkout and hold seats for 10 minutes (Story 3).
// Body: { eventId, buyerName, seats }. Any price in the body is ignored.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: { code: "invalid_body", message: "Invalid request." } }, { status: 400 });
  }

  const result = startCheckout(body);
  if (!result.ok) {
    const { ok, status, ...error } = result;
    return Response.json({ error }, { status });
  }
  return Response.json({ order: result.order }, { status: 201 });
}
