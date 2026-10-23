"use client";

// Story 3: Buy tickets. Payment is simulated (HW3 scope), and the typed
// name stands in for university sign-in (Story 2 is not built).
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { EventListing } from "@/lib/events";
import { formatPrice } from "@/lib/format";
import { ComingSoonButton } from "./ComingSoonButton";

type HeldOrder = { orderId: string; seats: number; amountCents: number; holdExpiresAt: string };
type Receipt = {
  orderId: string;
  seats: number;
  amountCents: number;
  buyerName: string;
  emailSentAt: string;
  tickets: { ticketId: string; qrDataUrl: string }[];
};
type Problem = { message: string; offerWaitlist?: boolean; restart?: boolean };
type Phase = "form" | "holding" | "held" | "paying" | "paid" | "ended";

const timeFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });

async function postJson(url: string, body: unknown): Promise<{ status: number; data: any }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function Checkout({ event }: { event: EventListing }) {
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("1");
  const [phase, setPhase] = useState<Phase>("form");
  const [order, setOrder] = useState<HeldOrder | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [msLeft, setMsLeft] = useState(0);
  const busy = useRef(false); // blocks a second click before React re-renders

  // Countdown for the 10-minute hold.
  useEffect(() => {
    if (phase !== "held" || !order) return;
    const tick = () => setMsLeft(new Date(order.holdExpiresAt).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, order]);

  const holdExpired = phase === "held" && order !== null && msLeft <= 0;

  async function holdSeats(e: FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setPhase("holding");
    setProblem(null);
    try {
      const { status, data } = await postJson("/api/orders", { eventId: event.eventId, buyerName: name, seats: Number(seats) });
      if (status === 201) {
        setOrder(data.order);
        setMsLeft(new Date(data.order.holdExpiresAt).getTime() - Date.now());
        setPhase("held");
      } else {
        setProblem({ message: data.error?.message ?? "Something went wrong. Please try again.", offerWaitlist: data.error?.offerWaitlist });
        setPhase("form");
      }
    } catch {
      setProblem({ message: "Something went wrong. Please try again." });
      setPhase("form");
    } finally {
      busy.current = false;
    }
  }

  async function pay(outcome: "success" | "declined") {
    if (busy.current || !order) return;
    busy.current = true;
    setPhase("paying");
    setProblem(null);
    try {
      const { status, data } = await postJson(`/api/orders/${encodeURIComponent(order.orderId)}/payment`, { buyerName: name, outcome });
      if (status === 200) {
        setReceipt(data.receipt);
        setPhase("paid");
      } else {
        setProblem({
          message: data.error?.message ?? "Something went wrong. Please try again.",
          offerWaitlist: data.error?.offerWaitlist,
          restart: !data.error?.offerWaitlist,
        });
        setPhase("ended");
      }
    } catch {
      setProblem({ message: "Something went wrong. Please try again." });
      setPhase("held");
    } finally {
      busy.current = false;
    }
  }

  function startAgain() {
    setOrder(null);
    setReceipt(null);
    setProblem(null);
    setPhase("form");
  }

  if (phase === "paid" && receipt) {
    return (
      <section className="checkout" aria-live="polite">
        <h2>You&apos;re going!</h2>
        <p>
          {receipt.seats} {receipt.seats === 1 ? "ticket" : "tickets"} for {event.title}. Total paid:{" "}
          {formatPrice(receipt.amountCents)} (simulated payment).
        </p>
        <p className="muted">
          Receipt emailed to {receipt.buyerName} at {timeFormatter.format(new Date(receipt.emailSentAt))} (simulated email).
        </p>
        <ul className="qr-list">
          {receipt.tickets.map((t, i) => (
            <li key={t.ticketId}>
              <img src={t.qrDataUrl} alt={`QR code for ticket ${i + 1}`} width={160} height={160} />
              <span>Ticket {i + 1}</span>
            </li>
          ))}
        </ul>
        <p>
          <a href="/">Back to all events</a>
        </p>
      </section>
    );
  }

  return (
    <section className="checkout">
      {(phase === "form" || phase === "holding") && (
        <form onSubmit={holdSeats} noValidate className="checkout-form">
          <div className="field">
            <label htmlFor="buyer-name">Your name</label>
            <input
              id="buyer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              aria-describedby="buyer-name-hint"
            />
            <p id="buyer-name-hint" className="hint">
              Stands in for university sign-in, which isn&apos;t built yet.
            </p>
          </div>
          <div className="field">
            <label htmlFor="seat-count">Tickets (1–4)</label>
            <input
              id="seat-count"
              type="number"
              inputMode="numeric"
              min={1}
              max={4}
              step={1}
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
            />
          </div>
          <button type="submit" className="button" disabled={phase === "holding"} aria-busy={phase === "holding"}>
            Hold my seats
          </button>
        </form>
      )}

      {(phase === "held" || phase === "paying") && order && (
        <div className="held">
          {holdExpired ? (
            <p role="alert">Your 10-minute hold ran out and the seats were released.</p>
          ) : (
            <p>
              Your {order.seats} {order.seats === 1 ? "seat is" : "seats are"} held for <strong>{formatCountdown(msLeft)}</strong>{" "}
              (until {timeFormatter.format(new Date(order.holdExpiresAt))}).
            </p>
          )}
          <p>
            Total: <strong>{formatPrice(order.amountCents)}</strong>
          </p>
          <div className="pay-buttons">
            <button type="button" className="button" disabled={phase === "paying" || holdExpired} onClick={() => pay("success")}>
              Simulated payment
            </button>
            <button
              type="button"
              className="button button-secondary"
              disabled={phase === "paying" || holdExpired}
              onClick={() => pay("declined")}
            >
              Simulate declined card
            </button>
          </div>
          <p className="hint">No real card is charged. These buttons stand in for Stripe Checkout.</p>
          {holdExpired && (
            <button type="button" className="button button-secondary" onClick={startAgain}>
              Start again
            </button>
          )}
        </div>
      )}

      {problem && (
        <div className="problem">
          <p role="alert">{problem.message}</p>
          {problem.offerWaitlist && <ComingSoonButton label="Join waitlist" eventTitle={event.title} />}
          {phase === "ended" && problem.restart && (
            <button type="button" className="button button-secondary" onClick={startAgain}>
              Start again
            </button>
          )}
        </div>
      )}
    </section>
  );
}
