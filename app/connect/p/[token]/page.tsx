"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";

function ConnectionContent() {
  const params = useParams();
  const token = params.token;

  const valid =
    typeof token === "string" &&
    /^[a-f0-9]{64}$/.test(token);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0b1020",
        color: "white",
        padding: 24,
      }}
    >
      <section
        style={{
          maxWidth: 460,
          width: "100%",
          padding: 32,
          background: "#161e32",
          borderRadius: 16,
          textAlign: "center",
        }}
      >
        <h1>Connect Your YouTube Channel</h1>

        <p>
          Connect your channel to Creator Command Center.
        </p>

        <p style={{ color: "#fbbf24", lineHeight: 1.7 }}>
          The workspace owner will be able to view
          your YouTube analytics and revenue information
          after you approve the connection.
        </p>

        {valid ? (
          <a
            href={
              "/api/youtube/permanent-authorize?token=" +
              encodeURIComponent(token)
            }
            style={{
              display: "inline-block",
              padding: "14px 22px",
              background: "#2563eb",
              color: "white",
              borderRadius: 8,
              textDecoration: "none",
              marginTop: 16,
              fontWeight: 700,
            }}
          >
            Continue with Google
          </a>
        ) : (
          <p style={{ color: "#ff8b8b" }}>
            Invalid connection link.
          </p>
        )}
      </section>
    </main>
  );
}

export default function PermanentConnectionPage() {
  return (
    <Suspense fallback={
      <main style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
      }}>
        Loading connection...
      </main>
    }>
      <ConnectionContent />
    </Suspense>
  );
}
