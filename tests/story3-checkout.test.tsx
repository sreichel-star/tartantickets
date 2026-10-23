// Story 3: Buy tickets — what the student sees on the checkout screen.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Checkout } from "@/components/Checkout";
import { EventList } from "@/components/EventList";
import type { EventListing } from "@/lib/events";

const listing: EventListing = {
  eventId: "evt-1",
  clubId: "club-1",
  clubName: "Jazz Ensemble Club",
  title: "Fall Jazz Night",
  description: "Live music.",
  startsAt: "2026-11-07T00:30:00Z",
  location: "Student Center Ballroom",
  priceCents: 800,
  capacity: 150,
  seatsRemaining: 89,
};

const heldOrder = {
  orderId: "ord-1",
  eventId: "evt-1",
  seats: 2,
  amountCents: 1600,
  status: "held",
  holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
};

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

function mockFetch(...responses: Array<[number, unknown]>) {
  const fn = vi.fn();
  for (const [status, body] of responses) fn.mockImplementationOnce(() => jsonResponse(status, body));
  vi.stubGlobal("fetch", fn);
  return fn;
}

function fillAndHold(name = "Ana", seats = "2") {
  fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(/tickets/i), { target: { value: seats } });
  fireEvent.click(screen.getByRole("button", { name: /hold my seats/i }));
}

afterEach(() => vi.unstubAllGlobals());

describe("Story 3: checkout screen", () => {
  it("story3_ui_buy_button_opens_checkout_page", () => {
    render(<EventList events={[listing]} />);
    const buy = screen.getByRole("button", { name: /^Buy/ });
    expect(buy.closest("form")).toHaveAttribute("action", "/events/evt-1");
  });

  it("story3_ui_seat_picker_allows_1_to_4", () => {
    render(<Checkout event={listing} />);
    const input = screen.getByLabelText(/tickets/i);
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "4");
  });

  it("story3_ui_shows_hold_time_and_server_total_after_holding", async () => {
    const fetchMock = mockFetch([201, { order: heldOrder }]);
    render(<Checkout event={listing} />);
    fillAndHold("Ana", "2");
    expect(await screen.findByText(/held for/i)).toBeInTheDocument();
    expect(screen.getByText("$16.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /simulated payment/i })).toBeInTheDocument();
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent).toEqual({ eventId: "evt-1", buyerName: "Ana", seats: 2 });
  });

  it("story3_ui_hold_button_disabled_after_one_click", async () => {
    const fetchMock = mockFetch([201, { order: heldOrder }]);
    render(<Checkout event={listing} />);
    fillAndHold();
    const button = screen.getByRole("button", { name: /hold my seats/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    await screen.findByText(/held for/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("story3_ui_payment_button_disabled_after_one_click", async () => {
    const fetchMock = mockFetch([201, { order: heldOrder }], [200, { receipt: receipt() }]);
    render(<Checkout event={listing} />);
    fillAndHold();
    const pay = await screen.findByRole("button", { name: /simulated payment/i });
    fireEvent.click(pay);
    fireEvent.click(pay);
    await screen.findByText(/you're going/i);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("story3_ui_successful_payment_shows_receipt_with_qr_codes", async () => {
    mockFetch([201, { order: heldOrder }], [200, { receipt: receipt() }]);
    render(<Checkout event={listing} />);
    fillAndHold();
    fireEvent.click(await screen.findByRole("button", { name: /simulated payment/i }));
    expect(await screen.findByText(/you're going/i)).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /qr code for ticket/i })).toHaveLength(2);
    expect(screen.getByText(/receipt emailed/i)).toBeInTheDocument();
  });

  it("story3_ui_declined_card_says_seats_were_released", async () => {
    mockFetch(
      [201, { order: heldOrder }],
      [402, { error: { code: "card_declined", message: "Your card was declined. Your seats were released." } }],
    );
    render(<Checkout event={listing} />);
    fillAndHold();
    fireEvent.click(await screen.findByRole("button", { name: /simulate declined card/i }));
    expect(await screen.findByText(/seats were released/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start again/i })).toBeInTheDocument();
  });

  it("story3_ui_sold_out_offers_join_waitlist", async () => {
    mockFetch([409, { error: { code: "sold_out", message: "Sorry, this event just sold out.", offerWaitlist: true } }]);
    render(<Checkout event={listing} />);
    fillAndHold();
    expect(await screen.findByText(/just sold out/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /join waitlist/i })).toBeInTheDocument();
  });

  it("story3_ui_shows_server_refusal_message", async () => {
    mockFetch([400, { error: { code: "over_limit", message: "You can buy 1 more ticket for this event." } }]);
    render(<Checkout event={listing} />);
    fillAndHold("Ana", "3");
    expect(await screen.findByRole("alert")).toHaveTextContent("You can buy 1 more ticket for this event.");
    // The form is usable again so the student can fix it.
    expect(screen.getByRole("button", { name: /hold my seats/i })).not.toBeDisabled();
  });
});

function receipt() {
  return {
    orderId: "ord-1",
    eventTitle: "Fall Jazz Night",
    seats: 2,
    amountCents: 1600,
    buyerName: "Ana",
    paidAt: new Date().toISOString(),
    emailSentAt: new Date().toISOString(),
    tickets: [
      { ticketId: "tkt-1", qrDataUrl: "data:image/png;base64,AAA" },
      { ticketId: "tkt-2", qrDataUrl: "data:image/png;base64,BBB" },
    ],
  };
}
