import { notFound } from "next/navigation";
import { Checkout } from "@/components/Checkout";
import { getUpcomingEvent } from "@/lib/events";
import { formatEventDate, formatPrice, formatSeatsRemaining } from "@/lib/format";

export const dynamic = "force-dynamic";

// Story 3: checkout page for one event.
export default async function EventCheckoutPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = getUpcomingEvent(eventId);
  if (!event) notFound();

  return (
    <>
      <p className="back">
        <a href="/">← All events</a>
      </p>
      <h1>Buy tickets</h1>
      <div className="card checkout-card">
        <article aria-labelledby="event-title">
          <p className="club">{event.clubName}</p>
          <h2 id="event-title" className="title">
            {event.title}
          </h2>
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
              <dd>{formatPrice(event.priceCents)} per ticket</dd>
            </div>
            <div>
              <dt>Seats</dt>
              <dd>{formatSeatsRemaining(event.seatsRemaining)}</dd>
            </div>
          </dl>
          <Checkout event={event} />
        </article>
      </div>
    </>
  );
}
