import type { EventListing } from "@/lib/events";
import { formatEventDate, formatPrice, formatSeatsRemaining, LOW_SEATS_THRESHOLD } from "@/lib/format";
import { ComingSoonButton } from "./ComingSoonButton";

// All event text is rendered as plain text (React escapes it), never as HTML.

export function EventCard({ event }: { event: EventListing }) {
  const soldOut = event.seatsRemaining <= 0;
  const low = !soldOut && event.seatsRemaining <= LOW_SEATS_THRESHOLD;
  const seatsClass = soldOut ? "seats seats-out" : low ? "seats seats-low" : "seats";

  return (
    <li className="card">
      <article aria-labelledby={`title-${event.eventId}`}>
        <p className="club">{event.clubName}</p>
        <h2 id={`title-${event.eventId}`} className="title">
          {event.title}
        </h2>
        <p className="description">{event.description}</p>
        <dl className="details">
          <div>
            <dt>Date</dt>
            <dd>
              <time dateTime={event.startsAt}>{formatEventDate(event.startsAt)}</time>
            </dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{event.location}</dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd>{formatPrice(event.priceCents)}</dd>
          </div>
          <div>
            <dt>Seats</dt>
            <dd className={seatsClass}>{formatSeatsRemaining(event.seatsRemaining)}</dd>
          </div>
        </dl>
        <ComingSoonButton label={soldOut ? "Join waitlist" : "Buy"} eventTitle={event.title} />
      </article>
    </li>
  );
}

export function EventList({ events }: { events: EventListing[] }) {
  if (events.length === 0) {
    return <p className="empty">No upcoming events yet.</p>;
  }
  return (
    <ul className="event-list">
      {events.map((e) => (
        <EventCard key={e.eventId} event={e} />
      ))}
    </ul>
  );
}
