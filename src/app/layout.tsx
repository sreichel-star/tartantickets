import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tartan Tickets",
  description: "Tickets for student club events.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <div className="container">
            <span className="logo">Tartan Tickets</span>
          </div>
        </header>
        <main id="main" className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
