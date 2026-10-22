import { listUpcomingEvents } from "@/lib/events";

// Always compute fresh, since "upcoming" depends on the current time.
export const dynamic = "force-dynamic";

// GET /api/events — public list of upcoming events.
export function GET() {
  return Response.json({ events: listUpcomingEvents() });
}
