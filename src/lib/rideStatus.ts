export type RideDisplayStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';

const START_GRACE_MS = 5 * 60 * 1000; // 5 minutes
const COMPLETION_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

function parseRideTimestamp(dateString?: string | null): Date | null {
  if (!dateString) return null;

  const trimmed = dateString.split(/[Z+]/)[0].replace('T', ' ');
  const localParsed = new Date(trimmed);
  if (!Number.isNaN(localParsed.getTime())) {
    return localParsed;
  }

  const fallback = new Date(dateString);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }

  return null;
}

export function deriveRideDisplayStatus(ride: {
  status?: string | null;
  departure_time?: string | null;
  arrival_time?: string | null;
}): RideDisplayStatus {
  if (ride.status === 'cancelled') {
    return 'cancelled';
  }

  const departure = parseRideTimestamp(ride.departure_time);
  if (!departure) {
    return 'completed';
  }

  const arrival = parseRideTimestamp(ride.arrival_time);
  const completionTime = arrival?.getTime() ?? departure.getTime() + DEFAULT_DURATION_MS;

  const now = Date.now();
  const hasStarted = now >= departure.getTime() - START_GRACE_MS;
  const stillOngoing = now <= completionTime + COMPLETION_BUFFER_MS;

  if (!hasStarted) {
    return 'upcoming';
  }

  if (stillOngoing) {
    return 'active';
  }

  return 'completed';
}
