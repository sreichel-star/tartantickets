import { EventList } from "@/components/EventList";
import { listUpcomingEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const events = listUpcomingEvents();
  return (
    <>
      <h1>Upcoming events</h1>
      <EventList events={events} />
    </>
  );
}
