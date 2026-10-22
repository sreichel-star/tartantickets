"use client";

export default function ErrorState({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="status" role="alert">
      <p>Sorry, we couldn&apos;t load events right now.</p>
      <button type="button" className="button" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
