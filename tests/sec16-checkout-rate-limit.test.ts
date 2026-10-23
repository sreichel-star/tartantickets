// SEC-16 (TEST_SPEC: test_checkout_hoarding_rate_limit):
// If a single account starts more than 5 checkouts for one event within 10 minutes,
// then the system shall block further checkouts for that account for 30 minutes.
// HW3 scope: the typed name stands in for the account.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { __setEventsForTesting, __resetEvents, type ClubEvent } from "@/lib/events";
import { __resetOrders } from "@/lib/orderStore";
import { POST as postOrdersRoute } from "@/app/api/orders/route";
import { POST as postPaymentRoute } from "@/app/api/orders/[orderId]/payment/route";

const T0 = new Date("2026-11-01T12:00:00Z");
const MIN = 60 * 1000;

const evt: ClubEvent = {
  eventId: "evt-a",
  clubId: "club-test",
  clubName: "Test Club",
  title: "Event A",
  description: "",
  startsAt: "2099-01-01T19:00:00Z",
  location: "Hall",
  priceCents: 1000,
  capacity: 100,
  seatsSold: 0,
  status: "published",
};

async function startCheckout(buyerName: string, eventId = "evt-a") {
  const res = await postOrdersRoute(
    new Request("http://test/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId, buyerName, seats: 1 }),
    }),
  );
  return { status: res.status, body: await res.json() };
}

async function decline(orderId: string, buyerName: string) {
  await postPaymentRoute(
    new Request(`http://test/api/orders/${orderId}/payment`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ buyerName, outcome: "declined" }),
    }),
    { params: Promise.resolve({ orderId }) },
  );
}

/** Start and abandon (decline) a checkout, the way someone hoarding seats would. */
async function startAndAbandon(buyerName: string, eventId = "evt-a") {
  const r = await startCheckout(buyerName, eventId);
  expect(r.status).toBe(201);
  await decline(r.body.order.orderId, buyerName);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  __setEventsForTesting([{ ...evt }, { ...evt, eventId: "evt-b", title: "Event B" }]);
});

afterEach(() => {
  vi.useRealTimers();
  __resetOrders();
  __resetEvents();
});

describe("SEC-16: checkout hoarding rate limit", () => {
  it("a student who starts more than 5 checkouts for one event within 10 minutes is blocked from checkout for 30 minutes", async () => {
    for (let i = 0; i < 5; i++) {
      vi.setSystemTime(new Date(T0.getTime() + i * MIN));
      await startAndAbandon("Hoarder");
    }

    // 6th checkout, still within 10 minutes of the first: refused and blocked.
    const blockedAt = new Date(T0.getTime() + 5 * MIN);
    vi.setSystemTime(blockedAt);
    const sixth = await startCheckout("Hoarder");
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.code).toBe("too_many_checkouts");

    // Still blocked just before 30 minutes, even though the first 5 starts are now old.
    vi.setSystemTime(new Date(blockedAt.getTime() + 30 * MIN - 1000));
    expect((await startCheckout("Hoarder")).status).toBe(429);

    // Allowed again after 30 minutes.
    vi.setSystemTime(new Date(blockedAt.getTime() + 30 * MIN));
    expect((await startCheckout("Hoarder")).status).toBe(201);
  });

  it("the block applies only to that student and that event", async () => {
    for (let i = 0; i < 5; i++) await startAndAbandon("Hoarder");
    expect((await startCheckout("Hoarder")).status).toBe(429);

    expect((await startCheckout("Someone Else")).status).toBe(201);
    expect((await startCheckout("Hoarder", "evt-b")).status).toBe(201);
  });

  it("5 checkouts within 10 minutes are still allowed, and checkouts spread over more than 10 minutes are never blocked", async () => {
    for (let i = 0; i < 5; i++) await startAndAbandon("Normal Student");
    // One checkout every 3 minutes: never more than 4 in any 10-minute window.
    for (let i = 0; i < 8; i++) {
      vi.setSystemTime(new Date(T0.getTime() + 11 * MIN + i * 3 * MIN));
      await startAndAbandon("Patient Student");
    }
  });
});
