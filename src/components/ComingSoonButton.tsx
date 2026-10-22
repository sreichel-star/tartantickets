"use client";

import { useState } from "react";

// Buying and the waitlist are built in later stories.
// For now the button just tells the student it's coming soon.
export function ComingSoonButton({ label, eventTitle }: { label: string; eventTitle: string }) {
  const [clicked, setClicked] = useState(false);

  return (
    <div className="action">
      <button
        type="button"
        className="button"
        aria-label={`${label}: ${eventTitle}`}
        onClick={() => setClicked(true)}
      >
        {label}
      </button>
      <p className="coming-soon" role="status" aria-live="polite">
        {clicked ? "Coming soon" : ""}
      </p>
    </div>
  );
}
