// Story 1: Browse events — what the student sees.
import { describe, it, expect } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
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

describe("Story 1: event list screen", () => {
  it("story1_card_shows_date_location_price_and_seats", () => {
    render(<EventList events={[listing]} />);
    const card = screen.getByRole("listitem");
    expect(within(card).getByText("Fall Jazz Night")).toBeInTheDocument();
    expect(within(card).getByText("Fri, Nov 6, 2026 · 7:30 PM")).toBeInTheDocument();
    expect(within(card).getByText("Student Center Ballroom")).toBeInTheDocument();
    expect(within(card).getByText("$8.00")).toBeInTheDocument();
    expect(within(card).getByText("89 seats left")).toBeInTheDocument();
  });

  it("story1_available_event_shows_buy_not_waitlist", () => {
    render(<EventList events={[listing]} />);
    expect(screen.getByRole("button", { name: /^Buy/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Join waitlist/ })).not.toBeInTheDocument();
  });

  it("story1_sold_out_event_shows_join_waitlist_instead_of_buy", () => {
    render(<EventList events={[{ ...listing, seatsRemaining: 0 }]} />);
    expect(screen.getByText("Sold out")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Join waitlist/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Buy/ })).not.toBeInTheDocument();
  });

  it("story1_low_seats_shows_only_n_left", () => {
    render(<EventList events={[{ ...listing, seatsRemaining: 3 }]} />);
    expect(screen.getByText("Only 3 left!")).toBeInTheDocument();
  });

  it("story1_buttons_say_coming_soon_when_clicked", () => {
    render(<EventList events={[listing]} />);
    expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Buy/ }));
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  it("story1_empty_state_message", () => {
    render(<EventList events={[]} />);
    expect(screen.getByText("No upcoming events yet.")).toBeInTheDocument();
  });

  it("story1_event_text_rendered_as_plain_text", () => {
    const evil = '<script>alert("x")</script>';
    const { container } = render(<EventList events={[{ ...listing, title: evil, description: evil }]} />);
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getAllByText(evil)).toHaveLength(2);
  });
});
