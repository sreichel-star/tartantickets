// Story 3: Buy tickets — server rules, tested through the real API routes.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { __setEventsForTesting, __resetEvents, getUpcomingEvent, type ClubEvent } from "@/lib/events";
import { __resetOrders, getOutbox } from "@/lib/orderStore";
import { POST as postOrdersRoute } from "@/app/api/orders/route";
import { POST as postPaymentRoute } from "@/app/api/orders/[orderId]/payment/route";

const T0 = new Date("2026-11-01T12:00:00Z");
const MIN = 60 * 1000;

const evt: ClubEvent = {
  eventId: "evt-test",
  clubId: "club-test",
  clubName: "Test Club",
  title: "Test Concert",
  description: "A test event.",
  startsAt: "2099-01-01T19:00:00Z",
  location: "Test Hall",
  priceCents: 1200,
  capacity: 10,
  seatsSold: 0,
  status: "published",
};

function setNow(d: Date) {
  vi.setSystemTime(d);
}

async function startCheckout(body: Record<string, unknown>) {
  const res = await postOrdersRoute(
    new Request("http://test/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, body: await res.json() };
}

async function pay(orderId: string, body: Record<string, unknown>) {
  const res = await postPaymentRoute(
    new Request(`http://test/api/orders/${orderId}/payment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ orderId }) },
  );
  return { status: res.status, body: await res.json() };
}

const seatsLeft = () => getUpcomingEvent("evt-test")?.seatsRemaining;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  setNow(T0);
  __setEventsForTesting([{ ...evt }]);
});

afterEach(() => {
  vi.useRealTimers();
  __resetOrders();
  __resetEvents();
});

describe("Story 3 AC1: cap the order at 4 seats", () => {
  it("story3_rejects_more_than_4_seats_with_400", async () => {
    const r = await startCheckout({ eventId: "evt-test", buyerName: "Ana", seats: 5 });
    expect(r.status).toBe(400);
    expect(r.body.error.message).toMatch(/at most 4/i);
    expect(seatsLeft()).toBe(10); // nothing was held
  });

  it("story3_rejects_zero_negative_fractional_and_non_number_seats", async () => {
    for (const seats of [0, -1, 1.5, "two", null]) {
      const r = await startCheckout({ eventId: "evt-test", buyerName: "Ana", seats });
      expect(r.status).toBe(400);
    }
    expect(seatsLeft()).toBe(10);
  });

  it("story3_accepts_1_and_4_seats", async () => {
    expect((await startCheckout({ eventId: "evt-test", buyerName: "Ana", seats: 1 })).status).toBe(201);
    expect((await startCheckout({ eventId: "evt-test", buyerName: "Ben", seats: 4 })).status).toBe(201);
  });

  it("story3_cap_is_per_student_per_event_and_shows_remaining_allowance", async () => {
    expect((await startCheckout({ eventId: "evt-test", buyerName: "Ana Lee", seats: 3 })).status).toBe(201);
    // Same student (name typed with different case/spaces) asks for 2 more: only 1 allowed.
    const r = await startCheckout({ eventId: "evt-test", buyerName: "  ana lee ", seats: 2 });
    expect(r.status).toBe(400);
    expect(r.body.error.allowanceRemaining).toBe(1);
    expect(r.body.error.message).toMatch(/1 more/);
    // A different student is not affected.
    expect((await startCheckout({ eventId: "evt-test", buyerName: "Ben", seats: 2 })).status).toBe(201);
  });
});

describe("Story 3 AC2: hold seats for 10 minutes when checkout starts", () => {
  it("story3_checkout_holds_seats_for_10_minutes", async () => {
    const r = await startCheckout({ eventId: "evt-test", buyerName: "Ana", seats: 3 });
    expect(r.status).toBe(201);
    expect(r.body.order.status).toBe("held");
    expect(new Date(r.body.order.holdExpiresAt).getTime()).toBe(T0.getTime() + 10 * MIN);
    expect(seatsLeft()).toBe(7);

    setNow(new Date(T0.getTime() + 10 * MIN - 1000)); // 9:59 later
    expect(seatsLeft()).toBe(7);

    setNow(new Date(T0.getTime() + 10 * MIN)); // 10:00 later
    expect(seatsLeft()).toBe(10);
  });

  it("story3_payment_after_hold_expires_is_refused", async () => {
    const { body } = await startCheckout({ eventId: "evt-test", buyerName: "Ana", seats: 2 });
    setNow(new Date(T0.getTime() + 10 * MIN + 1000));
    const r = await pay(body.order.orderId, { buyerName: "Ana", outcome: "success" });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("hold_expired");
    expect(seatsLeft()).toBe(10);
    expect(getOutbox()).toHaveLength(0);
  });
});

describe("Story 3 AC3: email a receipt with a QR code within 1 minute of payment", () => {
  it("story3_successful_payment_issues_one_unique_ticket_per_seat", async () => {
    const { body } = await startCheckout({ eventId: "evt-test", buyerName: "Ana", seats: 3 });
    const r = await pay(body.order.orderId, { buyerName: "Ana", outcome: "success" });
    expect(r.status).toBe(200);
    expect(r.body.receipt.tickets).toHaveLength(3);
    const ids = new Set(r.body.receipt.tickets.map((t: { ticketId: string }) => t.ticketId));
    expect(ids.size).toBe(3);
    expect(seatsLeft()).toBe(7); // now sold, not just held
  });

  it("story3_receipt_with_qr_emailed_within_1_minute", async () => {
    const { body } = await startCheckout({ eventId: "evt-test", buyerName: "Ana", seats: 2 });
    const r = await pay(body.order.orderId, { buyerName: "Ana", outcome: "success" });
    const outbox = getOutbox();
    expect(outbox).toHaveLength(1);
    const email = outbox[0];
    expect(email.to).toBe("Ana");
    expect(email.orderId).toBe(body.order.orderId);
    expect(email.qrCodes).toHaveLength(2);
    for (const qr of email.qrCodes) expect(qr).toMatch(/^data:image\/png;base64,/);
    const paidAt = new Date(r.body.receipt.paidAt).getTime();
    expect(new Date(email.sentAt).getTime() - paidAt).toBeLessThanOrEqual(60 * 1000);
  });

  it("story3_qr_tokens_are_random_128_bit_and_contain_no_name", async () => {
    const { body } = await startCheckout({ eventId: "evt-test", buyerName: "Ana", seats: 4 });
    await pay(body.order.orderId, { buyerName: "Ana", outcome: "success" });
    const tokens = getOutbox()[0].qrTokens;
    expect(new Set(tokens).size).toBe(4);
    for (const t of tokens) {
      expect(Buffer.from(t, "base64url").length).toBeGreaterThanOrEqual(16);
      expect(t.toLowerCase()).not.toContain("ana");
    }
  });

  it("story3_paying_twice_does_not_duplicate_tickets", async () => {
    const { body } = await startCheckout({ eventId: "evt-test", buyerName: "Ana", seats: 2 });
    const first = await pay(body.order.orderId, { buyerName: "Ana", outcome: "success" });
    const second = await pay(body.order.orderId, { buyerName: "Ana", outcome: "success" });
    expect(second.status).toBe(200);
    expect(second.body.receipt.tickets).toEqual(first.body.receipt.tickets);
    expect(getOutbox()).toHaveLength(1);
    expect(seatsLeft()).toBe(8);
  });
});

describe("Story 3 AC4: release held seats when the card is declined", () => {
  it("story3_declined_card_releases_held_seats", async () => {
    const { body } = await startCheckout({ eventId: "evt-test", buyerName: "Ana", seats: 4 });
    expect(seatsLeft()).toBe(6);
    const r = await pay(body.order.orderId, { buyerName: "Ana", outcome: "declined" });
    expect(r.status).toBe(402);
    expect(r.body.error.code).toBe("card_declined");
    expect(seatsLeft()).toBe(10);
    expect(getOutbox()).toHaveLength(0);
    // The declined checkout cannot be paid afterwards.
    expect((await pay(body.order.orderId, { buyerName: "Ana", outcome: "success" })).status).toBe(409);
  });

  it("story3_declined_seats_do_not_count_against_the_4_seat_cap", async () => {
    const { body } = await startCheckout({ eventId: "evt-test", buyerName: "Ana", seats: 4 });
    await pay(body.order.orderId, { buyerName: "Ana", outcome: "declined" });
    expect((await startCheckout({ eventId: "evt-test", buyerName: "Ana", seats: 4 })).status).toBe(201);
  });
});

describe("Story 3 AC5: offer the waitlist if the event sells out during checkout", () => {
  it("story3_sold_out_at_checkout_returns_409_and_offers_waitlist", async () => {
    __setEventsForTesting([{ ...evt, seatsSold: 10 }]);
    const r = await startCheckout({ eventId: "evt-test", buyerName: "Ana", seats: 1 });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("sold_out");
    expect(r.body.error.offerWaitlist).toBe(true);
  });

  it("story3_last_seats_taken_by_someone_else_offers_waitlist", async () => {
    __setEventsForTesting([{ ...evt, seatsSold: 8 }]);
    expect((await startCheckout({ eventId: "evt-test", buyerName: "Ben", seats: 2 })).status).toBe(201);
    const r = await startCheckout({ eventId: "evt-test", buyerName: "Ana", seats: 1 });
    expect(r.status).toBe(409);
    expect(r.body.error.offerWaitlist).toBe(true);
  });

  it("story3_sold_out_after_hold_expired_offers_waitlist_at_payment", async () => {
    __setEventsForTesting([{ ...evt, seatsSold: 8 }]);
    const ana = await startCheckout({ eventId: "evt-test", buyerName: "Ana", seats: 2 });
    setNow(new Date(T0.getTime() + 11 * MIN)); // Ana's hold ran out...
    const ben = await startCheckout({ eventId: "evt-test", buyerName: "Ben", seats: 2 });
    await pay(ben.body.order.orderId, { buyerName: "Ben", outcome: "success" }); // ...and Ben bought the last seats
    const r = await pay(ana.body.order.orderId, { buyerName: "Ana", outcome: "success" });
    expect(r.status).toBe(409);
    expect(r.body.error.offerWaitlist).toBe(true);
  });

  it("story3_fewer_seats_left_than_requested_returns_409_with_count", async () => {
    __setEventsForTesting([{ ...evt, seatsSold: 8 }]);
    const r = await startCheckout({ eventId: "evt-test", buyerName: "Ana", seats: 3 });
    expect(r.status).toBe(409);
    expect(r.body.error.seatsRemaining).toBe(2);
    expect(r.body.error.offerWaitlist).toBe(false);
  });
});

describe("Story 3: spec rules that apply to buying", () => {
  it("story3_50_simultaneous_buyers_for_last_seat_exactly_1_succeeds", async () => {
    __setEventsForTesting([{ ...evt, seatsSold: 9 }]);
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) => startCheckout({ eventId: "evt-test", buyerName: `Buyer ${i}`, seats: 1 })),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(49);
  });

  it("story3_charge_uses_server_price_not_browser_price", async () => {
    const r = await startCheckout({ eventId: "evt-test", buyerName: "Ana", seats: 2, priceCents: 1, amountCents: 1 });
    expect(r.body.order.amountCents).toBe(2400);
  });

  it("story3_blank_name_is_treated_as_not_signed_in_401", async () => {
    for (const buyerName of ["", "   ", undefined]) {
      expect((await startCheckout({ eventId: "evt-test", buyerName, seats: 1 })).status).toBe(401);
    }
  });

  it("story3_name_longer_than_80_characters_is_rejected", async () => {
    const r = await startCheckout({ eventId: "evt-test", buyerName: "A".repeat(81), seats: 1 });
    expect(r.status).toBe(400);
    expect(seatsLeft()).toBe(10);
  });

  it("story3_unknown_past_or_cancelled_event_returns_404", async () => {
    __setEventsForTesting([
      { ...evt, eventId: "past", startsAt: "2020-01-01T00:00:00Z" },
      { ...evt, eventId: "cancelled", status: "cancelled" },
    ]);
    for (const eventId of ["nope", "past", "cancelled"]) {
      expect((await startCheckout({ eventId, buyerName: "Ana", seats: 1 })).status).toBe(404);
    }
  });

  it("story3_another_student_cannot_pay_for_or_see_an_order", async () => {
    const { body } = await startCheckout({ eventId: "evt-test", buyerName: "Ana", seats: 2 });
    const r = await pay(body.order.orderId, { buyerName: "Mallory", outcome: "success" });
    expect(r.status).toBe(404);
    expect((await pay("ord-does-not-exist", { buyerName: "Ana", outcome: "success" })).status).toBe(404);
    expect(getOutbox()).toHaveLength(0);
  });

  it("story3_invalid_json_body_returns_400", async () => {
    const res = await postOrdersRoute(new Request("http://test/api/orders", { method: "POST", body: "not json" }));
    expect(res.status).toBe(400);
  });
});
