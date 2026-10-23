// Story 3: orders, held seats, and the simulated email outbox.
// Everything lives in server memory (HW3 scope: no database), so it
// resets whenever the server restarts or a new version is deployed.

export const HOLD_MINUTES = 10;

export type OrderStatus = "held" | "paid" | "declined" | "expired";

export type Ticket = {
  ticketId: string;
  qrToken: string; // random, no personal data (SEC-13)
};

export type Order = {
  orderId: string;
  eventId: string;
  buyerName: string; // stand-in for a signed-in user (HW3 scope)
  buyerKey: string; // buyerName lowercased with spaces tidied, used to match the same student
  seats: number;
  amountCents: number; // always computed on the server (SEC-8)
  status: OrderStatus;
  createdAt: string;
  holdExpiresAt: string;
  paidAt?: string;
  emailSentAt?: string;
  tickets: Ticket[];
};

/** A receipt "email". No real email is sent (see README non-goals). */
export type SentEmail = {
  to: string;
  subject: string;
  orderId: string;
  sentAt: string;
  qrTokens: string[];
  qrCodes: string[]; // PNG data URLs, one per ticket
};

let orders: Order[] = [];
let outbox: SentEmail[] = [];

/** A held order counts against seats until its hold time runs out. */
export function isActiveHold(order: Order, now: Date): boolean {
  return order.status === "held" && new Date(order.holdExpiresAt).getTime() > now.getTime();
}

export function heldSeatsFor(eventId: string, now: Date = new Date()): number {
  return orders
    .filter((o) => o.eventId === eventId && isActiveHold(o, now))
    .reduce((sum, o) => sum + o.seats, 0);
}

export function ordersFor(eventId: string): Order[] {
  return orders.filter((o) => o.eventId === eventId);
}

export function findOrder(orderId: string): Order | undefined {
  return orders.find((o) => o.orderId === orderId);
}

export function addOrder(order: Order): void {
  orders.push(order);
}

export function sendEmail(email: SentEmail): void {
  outbox.push(email);
}

export function getOutbox(): SentEmail[] {
  return outbox.map((e) => ({ ...e }));
}

/** Test helper: forget all orders and emails. */
export function __resetOrders(): void {
  orders = [];
  outbox = [];
}
