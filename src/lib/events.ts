// Event data for Story 1 (Browse events).
// For now, events live in server memory and are made-up sample data.
// They reset whenever the server restarts. A real database comes later.

export type EventStatus = "published" | "cancelled";

export type ClubEvent = {
  eventId: string;
  clubId: string;
  clubName: string;
  title: string;
  description: string;
  startsAt: string; // ISO date-time with time zone offset
  location: string;
  priceCents: number; // 0 means free
  capacity: number;
  seatsSold: number;
  status: EventStatus;
};

/** What the browse page and GET /api/events return for each event. */
export type EventListing = Omit<ClubEvent, "seatsSold" | "status"> & {
  seatsRemaining: number;
};

const sampleEvents: ClubEvent[] = [
  {
    eventId: "evt-jazz-night",
    clubId: "club-jazz",
    clubName: "Jazz Ensemble Club",
    title: "Fall Jazz Night",
    description: "An evening of student jazz combos, with coffee and dessert.",
    startsAt: "2026-11-06T19:30:00-05:00",
    location: "Student Center Ballroom",
    priceCents: 800,
    capacity: 150,
    seatsSold: 61,
    status: "published",
  },
  {
    eventId: "evt-diwali-dinner",
    clubId: "club-sasa",
    clubName: "South Asian Student Association",
    title: "Diwali Dinner",
    description: "A festive dinner with music and dance performances.",
    startsAt: "2026-11-08T18:30:00-05:00",
    location: "Dining Hall East",
    priceCents: 1500,
    capacity: 120,
    seatsSold: 120,
    status: "published",
  },
  {
    eventId: "evt-robotics-showcase",
    clubId: "club-robotics",
    clubName: "Robotics Club",
    title: "Robotics Showcase",
    description: "See this semester's student-built robots in action.",
    startsAt: "2026-11-13T18:00:00-05:00",
    location: "Engineering Hall Atrium",
    priceCents: 0,
    capacity: 200,
    seatsSold: 37,
    status: "published",
  },
  {
    eventId: "evt-improv-show",
    clubId: "club-improv",
    clubName: "Improv Troupe",
    title: "Improv Comedy Show",
    description: "Fully made-up scenes based on audience suggestions.",
    startsAt: "2026-11-20T20:00:00-05:00",
    location: "Black Box Theater",
    priceCents: 500,
    capacity: 80,
    seatsSold: 77,
    status: "published",
  },
  {
    eventId: "evt-winter-formal",
    clubId: "club-sab",
    clubName: "Student Activities Board",
    title: "Winter Formal",
    description: "Dress up, dance, and celebrate the end of the semester.",
    startsAt: "2026-12-05T21:00:00-05:00",
    location: "Grand Hall",
    priceCents: 2500,
    capacity: 400,
    seatsSold: 212,
    status: "published",
  },
  {
    eventId: "evt-board-games",
    clubId: "club-tabletop",
    clubName: "Tabletop Gaming Club",
    title: "Board Game Marathon",
    description: "Twelve hours of board games. Bring a friend or make new ones.",
    startsAt: "2027-01-23T12:00:00-05:00",
    location: "Library Commons",
    priceCents: 0,
    capacity: 60,
    seatsSold: 60,
    status: "published",
  },
  // Not shown: already happened.
  {
    eventId: "evt-welcome-mixer",
    clubId: "club-sab",
    clubName: "Student Activities Board",
    title: "Welcome Back Mixer",
    description: "Start-of-semester mixer.",
    startsAt: "2026-09-04T17:00:00-04:00",
    location: "Main Lawn",
    priceCents: 0,
    capacity: 300,
    seatsSold: 140,
    status: "published",
  },
  // Not shown: cancelled.
  {
    eventId: "evt-pumpkin-carving",
    clubId: "club-outdoors",
    clubName: "Outdoors Club",
    title: "Pumpkin Carving",
    description: "Cancelled due to scheduling conflict.",
    startsAt: "2026-11-01T14:00:00-05:00",
    location: "Main Lawn",
    priceCents: 300,
    capacity: 50,
    seatsSold: 12,
    status: "cancelled",
  },
];

// The in-memory "database". Copied so tests can't accidentally change the seed list.
let store: ClubEvent[] = sampleEvents.map((e) => ({ ...e }));

export function seatsRemaining(event: Pick<ClubEvent, "capacity" | "seatsSold">): number {
  return Math.max(0, event.capacity - event.seatsSold);
}

/**
 * Upcoming events: published, not yet started, soonest first.
 * `now` can be passed in so tests can control the current time.
 */
export function listUpcomingEvents(now: Date = new Date(), events: ClubEvent[] = store): EventListing[] {
  return events
    .filter((e) => e.status === "published" && new Date(e.startsAt).getTime() > now.getTime())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .map(({ seatsSold, status, ...rest }) => ({
      ...rest,
      seatsRemaining: seatsRemaining({ capacity: rest.capacity, seatsSold }),
    }));
}

/** Test helper: replace the in-memory events. */
export function __setEventsForTesting(events: ClubEvent[]): void {
  store = events.map((e) => ({ ...e }));
}

/** Test helper: restore the sample events. */
export function __resetEvents(): void {
  store = sampleEvents.map((e) => ({ ...e }));
}
