// Story 3: Buy tickets — the rules. Payments are simulated (HW3 scope).
import { randomBytes, randomUUID } from "node:crypto";
import QRCode from "qrcode";
import { getUpcomingEvent, recordSale } from "./events";
import {
  HOLD_MINUTES,
  addOrder,
  findOrder,
  isActiveHold,
  ordersFor,
  sendEmail,
  type Order,
} from "./orderStore";

export const MAX_SEATS_PER_STUDENT = 4;
export const MAX_NAME_LENGTH = 80;

export type CheckoutError = {
  ok: false;
  status: 400 | 401 | 402 | 404 | 409;
  code: string;
  message: string;
  allowanceRemaining?: number;
  seatsRemaining?: number;
  offerWaitlist?: boolean;
};

/** What the browser sees about a held order. */
export type PublicOrder = Pick<Order, "orderId" | "eventId" | "seats" | "amountCents" | "status" | "holdExpiresAt">;

export type Receipt = {
  orderId: string;
  eventTitle: string;
  startsAt: string;
  location: string;
  seats: number;
  amountCents: number;
  buyerName: string;
  paidAt: string;
  emailSentAt: string;
  tickets: { ticketId: string; qrDataUrl: string }[];
};

const fail = (status: CheckoutError["status"], code: string, message: string, extra: Partial<CheckoutError> = {}): CheckoutError => ({
  ok: false,
  status,
  code,
  message,
  ...extra,
});

const nameKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

function toPublic(o: Order): PublicOrder {
  return { orderId: o.orderId, eventId: o.eventId, seats: o.seats, amountCents: o.amountCents, status: o.status, holdExpiresAt: o.holdExpiresAt };
}

/** Checks the typed name, which stands in for a signed-in student. */
function checkName(buyerName: unknown): CheckoutError | string {
  if (typeof buyerName !== "string" || buyerName.trim() === "") {
    return fail(401, "name_required", "Enter your name to continue.");
  }
  const name = buyerName.trim().replace(/\s+/g, " ");
  if (name.length > MAX_NAME_LENGTH) {
    return fail(400, "name_too_long", `Your name can be at most ${MAX_NAME_LENGTH} characters.`);
  }
  return name;
}

const plural = (n: number) => `${n} ticket${n === 1 ? "" : "s"}`;

/**
 * Start checkout: check the rules, then hold the seats for 10 minutes.
 * Only eventId, buyerName and seats are read; any price sent by the browser is ignored (SEC-8).
 */
export function startCheckout(
  input: { eventId?: unknown; buyerName?: unknown; seats?: unknown },
  now: Date = new Date(),
): { ok: true; order: PublicOrder } | CheckoutError {
  const name = checkName(input.buyerName);
  if (typeof name !== "string") return name;

  const seats = input.seats;
  if (typeof seats !== "number" || !Number.isInteger(seats) || seats < 1) {
    return fail(400, "invalid_seats", `Choose between 1 and ${MAX_SEATS_PER_STUDENT} tickets.`);
  }
  if (seats > MAX_SEATS_PER_STUDENT) {
    return fail(400, "over_limit", `You can buy at most ${MAX_SEATS_PER_STUDENT} tickets per event.`, {
      allowanceRemaining: MAX_SEATS_PER_STUDENT,
    });
  }

  const event = typeof input.eventId === "string" ? getUpcomingEvent(input.eventId, now) : undefined;
  if (!event) return fail(404, "event_not_found", "This event isn't available.");

  // The 4-seat cap covers everything this student has paid for or is holding for this event.
  const key = nameKey(name);
  const alreadyHas = ordersFor(event.eventId)
    .filter((o) => o.buyerKey === key && (o.status === "paid" || isActiveHold(o, now)))
    .reduce((sum, o) => sum + o.seats, 0);
  const allowance = MAX_SEATS_PER_STUDENT - alreadyHas;
  if (seats > allowance) {
    const message =
      allowance <= 0
        ? `You already have ${MAX_SEATS_PER_STUDENT} tickets for this event, the most one student can buy.`
        : `You can buy ${allowance} more ${allowance === 1 ? "ticket" : "tickets"} for this event (limit ${MAX_SEATS_PER_STUDENT} per student).`;
    return fail(400, "over_limit", message, { allowanceRemaining: Math.max(0, allowance) });
  }

  if (event.seatsRemaining <= 0) {
    return fail(409, "sold_out", "Sorry, this event just sold out. Join the waitlist to get a seat if one opens up.", {
      seatsRemaining: 0,
      offerWaitlist: true,
    });
  }
  if (seats > event.seatsRemaining) {
    return fail(409, "not_enough_seats", `Only ${plural(event.seatsRemaining)} left. Choose fewer tickets.`, {
      seatsRemaining: event.seatsRemaining,
      offerWaitlist: false,
    });
  }

  const order: Order = {
    orderId: `ord-${randomUUID()}`,
    eventId: event.eventId,
    buyerName: name,
    buyerKey: key,
    seats,
    amountCents: event.priceCents * seats,
    status: "held",
    createdAt: now.toISOString(),
    holdExpiresAt: new Date(now.getTime() + HOLD_MINUTES * 60 * 1000).toISOString(),
    tickets: [],
  };
  addOrder(order);
  return { ok: true, order: toPublic(order) };
}

async function buildReceipt(order: Order, emailSentAt: string): Promise<Receipt> {
  const event = getUpcomingEvent(order.eventId, new Date(order.paidAt!));
  return {
    orderId: order.orderId,
    eventTitle: event?.title ?? "",
    startsAt: event?.startsAt ?? "",
    location: event?.location ?? "",
    seats: order.seats,
    amountCents: order.amountCents,
    buyerName: order.buyerName,
    paidAt: order.paidAt!,
    emailSentAt,
    tickets: await Promise.all(
      order.tickets.map(async (t) => ({ ticketId: t.ticketId, qrDataUrl: await QRCode.toDataURL(t.qrToken) })),
    ),
  };
}

/** Simulated payment for a held order. `outcome` is what the "card" does. */
export async function payForOrder(
  input: { orderId?: unknown; buyerName?: unknown; outcome?: unknown },
  now: Date = new Date(),
): Promise<{ ok: true; receipt: Receipt } | CheckoutError> {
  const name = checkName(input.buyerName);
  if (typeof name !== "string") return name;

  // Another student's order looks exactly like one that doesn't exist (SEC-6).
  const order = typeof input.orderId === "string" ? findOrder(input.orderId) : undefined;
  if (!order || order.buyerKey !== nameKey(name)) return fail(404, "order_not_found", "Order not found.");

  if (input.outcome !== "success" && input.outcome !== "declined") {
    return fail(400, "invalid_outcome", "Unknown payment result.");
  }

  // Paying twice returns the same receipt: no duplicate tickets or emails.
  if (order.status === "paid") {
    return { ok: true, receipt: await buildReceipt(order, order.emailSentAt ?? order.paidAt!) };
  }

  if (order.status === "held" && !isActiveHold(order, now)) order.status = "expired";
  if (order.status === "expired") {
    const event = getUpcomingEvent(order.eventId, now);
    const soldOut = !event || event.seatsRemaining <= 0;
    return fail(
      409,
      "hold_expired",
      soldOut
        ? `Your ${HOLD_MINUTES}-minute hold ran out and the event has now sold out. Join the waitlist to get a seat if one opens up.`
        : `Your ${HOLD_MINUTES}-minute hold ran out and the seats were released. Start again to buy tickets.`,
      { offerWaitlist: soldOut, seatsRemaining: event?.seatsRemaining ?? 0 },
    );
  }
  if (order.status === "declined") {
    return fail(409, "checkout_ended", "This checkout has ended. Start again to buy tickets.");
  }

  if (input.outcome === "declined") {
    order.status = "declined"; // releases the held seats
    return fail(402, "card_declined", "Your card was declined. Your seats were released.");
  }

  order.status = "paid";
  order.paidAt = now.toISOString();
  order.tickets = Array.from({ length: order.seats }, () => ({
    ticketId: `tkt-${randomUUID()}`,
    qrToken: randomBytes(16).toString("base64url"), // 128 random bits
  }));
  recordSale(order.eventId, order.seats);

  // Simulated receipt email, "sent" straight away (well within 1 minute).
  const sentAt = new Date().toISOString();
  order.emailSentAt = sentAt;
  const receipt = await buildReceipt(order, sentAt);
  sendEmail({
    to: order.buyerName,
    subject: `Your tickets for ${receipt.eventTitle}`,
    orderId: order.orderId,
    sentAt,
    qrTokens: order.tickets.map((t) => t.qrToken),
    qrCodes: receipt.tickets.map((t) => t.qrDataUrl),
  });
  return { ok: true, receipt };
}
