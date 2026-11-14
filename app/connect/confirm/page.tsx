
"use client";

import { useEffect, useState } from "react";

type Channel = {
  channelId: string;
  channelName: string;
  channelThumbnail: string | null;
  expiresAt: string;
};

export default function ConfirmConnectionPage() {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadChannel() {
      try {
        const response = await fetch(
          "/api/youtube/link-confirm",
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Unable to load channel"
          );
        }

        setChannel(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadChannel();
  }, []);

  async function confirmConnection() {
    if (confirming || !channel) return;

    setConfirming(true);
    setError("");

    try {
      const response = await fetch(
        "/api/youtube/link-confirm",
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Connection failed"
        );
      }

      window.location.href =
        "/connect/result?status=connected";
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Connection failed"
      );

      setConfirming(false);
    }
  }

  async function cancelConnection() {
    if (confirming || !channel) return;

    setConfirming(true);
    setError("");

    try {
      const response = await fetch(
        "/api/youtube/link-confirm",
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to cancel connection"
        );
      }

      window.location.href =
        "/connect/result?status=cancelled";
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Cancellation failed"
      );

      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.main}>
        <p>Loading channel details...</p>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <section style={styles.card}>
        <h1 style={styles.heading}>
          Confirm YouTube Connection
        </h1>

        {error && (
          <p role="alert" style={styles.error}>
            {error}
          </p>
        )}

        {channel && (
          <>
            {channel.channelThumbnail && (
              <img
                src={channel.channelThumbnail}
                alt={`${channel.channelName} thumbnail`}
                width={88}
                height={88}
                style={styles.thumbnail}
              />
            )}

            <h2 style={styles.channelName}>
              {channel.channelName}
            </h2>

            <p style={styles.muted}>
              Channel ID: {channel.channelId}
            </p>

            <p style={styles.description}>
              You are about to connect this YouTube
              channel to another person's Creator
              Command Center workspace.
            </p>

            <p style={styles.description}>
              The workspace owner will be able to
              access this channel's YouTube analytics
              and revenue data.
            </p>

            <p style={styles.warning}>
              Only confirm if you trust the person
              who sent you the connection link.
            </p>

            <button
              type="button"
              onClick={confirmConnection}
              disabled={confirming}
              style={{
                ...styles.button,
                opacity: confirming ? 0.6 : 1,
                cursor: confirming
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {confirming
                ? "Processing..."
                : "Confirm Connection"}
            </button>

            <button
              type="button"
              onClick={cancelConnection}
              disabled={confirming}
              style={styles.cancelButton}
            >
              Cancel Connection
            </button>
          </>
        )}

        {!channel && !error && (
          <p>Confirmation is unavailable.</p>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "#0b1020",
    color: "#ffffff",
  },

  card: {
    width: "100%",
    maxWidth: 460,
    padding: 32,
    borderRadius: 16,
    background: "#161e32",
    textAlign: "center",
  },

  heading: {
    fontSize: 25,
    fontWeight: 700,
    marginBottom: 24,
  },

  thumbnail: {
    borderRadius: "50%",
    objectFit: "cover",
  },

  channelName: {
    fontSize: 22,
    fontWeight: 700,
    marginTop: 16,
  },

  muted: {
    color: "#a5b4cc",
    overflowWrap: "anywhere",
    fontSize: 13,
    marginTop: 8,
  },

  description: {
    color: "#d1d9e6",
    lineHeight: 1.7,
    marginTop: 20,
  },

  warning: {
    color: "#fbbf24",
    fontSize: 13,
    lineHeight: 1.6,
    marginTop: 20,
  },

  error: {
    color: "#ff8b8b",
    marginBottom: 16,
  },

  button: {
    width: "100%",
    padding: "14px 24px",
    border: "none",
    borderRadius: 10,
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 15,
    marginTop: 24,
  },

  cancelButton: {
    background: "transparent",
    border: "none",
    color: "#a5b4cc",
    cursor: "pointer",
    textDecoration: "underline",
    marginTop: 20,
    fontSize: 14,
  },
};
