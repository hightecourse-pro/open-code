"use client";

/**
 * The last-resort boundary — it replaces the ROOT layout, so it must carry its
 * own <html>/<body> and inline styles (the app's CSS may be exactly what
 * failed). This is what a member sees when even the layout cannot render:
 * still Hebrew, still ours.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F4EDFB",
          fontFamily: '"Segoe UI", "Arial Hebrew", Arial, sans-serif',
          color: "#1A1420",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #E7E0EC",
            borderRadius: 22,
            padding: "40px 36px",
            maxWidth: 400,
            width: "calc(100% - 48px)",
            textAlign: "center",
            boxShadow: "0 8px 30px rgba(26,20,32,.08)",
          }}
        >
          <div
            style={{
              height: 4,
              width: 64,
              margin: "0 auto 22px",
              borderRadius: 4,
              background: "linear-gradient(135deg,#E0418D,#6B3D99)",
            }}
          />
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>משהו השתבש רגע 🙈</h1>
          <p style={{ color: "#574C60", fontSize: 14.5, lineHeight: 1.6, margin: "0 0 24px" }}>
            לא את — אנחנו. נסי לרענן, ואם זה חוזר — כתבי לנו ונטפל.
          </p>
          <button
            onClick={reset}
            style={{
              border: 0,
              cursor: "pointer",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              padding: "12px 30px",
              borderRadius: 12,
              background: "linear-gradient(135deg,#E0418D,#6B3D99)",
            }}
          >
            לנסות שוב
          </button>
          {error.digest && (
            <p dir="ltr" style={{ fontSize: 11, color: "#8A7F93", marginTop: 16, fontFamily: "monospace" }}>
              {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
