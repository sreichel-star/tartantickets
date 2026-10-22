// Story 1: Browse events — data rules.
import { describe, it, expect, afterEach } from "vitest";
import { listUpcomingEvents, seatsRemaining, __setEventsForTesting, __resetEvents, type ClubEvent } from "@/lib/events";
import { formatPrice, formatSeatsRemaining, formatEventDate } from "@/lib/format";
import { GET } from "@/app/api/events/route";

const base: ClubEvent = {
  eventId: "e",
  clubId: "c",
  clubName: "Club",
  title: "T",
  description: "D",
  startsAt: "2026-11-10T19:00:00-05:00",
  location: "L",
  priceCents: 500,
  capacity: 10,
  seatsSold: 0,
  status: "published",
};

afterEach(() => __resetEvents());

describe("Story 1: list upcoming events", () => {
  const now = new Date("2026-11-01T12:00:00-05:00");

  it("story1_lists_only_published_future_events_soonest_first", () => {
    const events: ClubEvent[] = [
      { ...base, eventId: "later", startsAt: "2026-12-01T19:00:00-05:00" },
      { ...base, eventId: "past", startsAt: "2026-10-01T19:00:00-04:00" },
      { ...base, eventId: "cancelled", status: "cancelled" },
      { ...base, eventId: "sooner", startsAt: "2026-11-05T19:00:00-05:00" },
    ];
    expect(listUpcomingEvents(now, events).map((e) => e.eventId)).toEqual(["sooner", "later"]);
  });

  it("story1_listing_includes_date_location_price_and_seats_remaining", () => {
    const [e] = listUpcomingEvents(now, [{ ...base, capacity: 10, seatsSold: 7 }]);
    expect(e.startsAt).toBe(base.startsAt);
    expect(e.location).toBe("L");
    expect(e.priceCents).toBe(500);
    expect(e.seatsRemaining).toBe(3);
    // Internal fields are not exposed.
    expect(e).not.toHaveProperty("seatsSold");
    expect(e).not.toHaveProperty("status");
  });

  it("story1_seats_remaining_never_negative", () => {
    expect(seatsRemaining({ capacity: 10, seatsSold: 12 })).toBe(0);
  });

  it("story1_sample_data_has_sold_out_free_and_low_seat_events", () => {
    const events = listUpcomingEvents(new Date("2026-10-22T12:00:00-04:00"));
    expect(events.length).toBeGreaterThanOrEqual(5);
    expect(events.some((e) => e.seatsRemaining === 0)).toBe(true);
    expect(events.some((e) => e.priceCents === 0)).toBe(true);
    expect(events.some((e) => e.seatsRemaining > 0 && e.seatsRemaining <= 5)).toBe(true);
  });
});

describe("Story 1: display formatting", () => {
  it("story1_price_shows_dollars_or_free", () => {
    expect(formatPrice(800)).toBe("$8.00");
    expect(formatPrice(0)).toBe("Free");
  });

  it("story1_seats_label_sold_out_low_and_normal", () => {
    expect(formatSeatsRemaining(0)).toBe("Sold out");
    expect(formatSeatsRemaining(3)).toBe("Only 3 left!");
    expect(formatSeatsRemaining(5)).toBe("Only 5 left!");
    expect(formatSeatsRemaining(6)).toBe("6 seats left");
  });

  it("story1_date_shown_in_pittsburgh_time", () => {
    // 00:30 UTC on Nov 7 is 7:30 PM on Nov 6 in Pittsburgh.
    expect(formatEventDate("2026-11-07T00:30:00Z")).toBe("Fri, Nov 6, 2026 · 7:30 PM");
  });
});

describe("Story 1: GET /api/events", () => {
  it("story1_api_returns_200_with_upcoming_events", async () => {
    __setEventsForTesting([{ ...base, eventId: "future", startsAt: "2099-01-01T12:00:00Z" }]);
    const res = GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events.map((e: { eventId: string }) => e.eventId)).toEqual(["future"]);
  });

  it("story1_api_returns_empty_list_when_no_events", async () => {
    __setEventsForTesting([]);
    const body = await GET().json();
    expect(body.events).toEqual([]);
  });
});
