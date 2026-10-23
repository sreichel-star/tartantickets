import { payForOrder } from "@/lib/orders";

// POST /api/orders/{orderId}/payment — simulated payment (Story 3, HW3 scope: no real payments).
// Body: { buyerName, outcome: "success" | "declined" }.
export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: { code: "invalid_body", message: "Invalid request." } }, { status: 400 });
  }

  const result = await payForOrder({ ...body, orderId });
  if (!result.ok) {
    const { ok, status, ...error } = result;
    return Response.json({ error }, { status });
  }
  return Response.json({ receipt: result.receipt }, { status: 200 });
}
