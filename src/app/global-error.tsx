"use client";
import { useEffect } from "react";

/**
 * Error en el layout raíz. Reemplaza todo el documento y no recibe los estilos globales,
 * por eso lleva los suyos en línea.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="es-CO">
      <body style={{ margin: 0, minHeight: "100dvh", display: "flex", alignItems: "center", background: "#0d1311", color: "#e6eee9", fontFamily: "system-ui, sans-serif" }}>
        <title>Algo salió mal</title>
        <main style={{ padding: "2rem 1.5rem", maxWidth: "36rem", margin: "0 auto" }}>
          <h1 style={{ margin: 0, fontSize: "2.5rem", fontWeight: 300, lineHeight: 1, textTransform: "uppercase" }}>Algo salió mal</h1>
          <p style={{ marginTop: "1.25rem", lineHeight: 1.6, color: "#b4c3bb" }}>No pudimos cargar la página. Tus planes, tus sats y tu saldo no cambian por este error.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: "2rem", padding: "0.75rem 1.2rem", border: 0, borderRadius: 10, background: "#f4a62a", color: "#1c1304", fontSize: "0.95rem", fontWeight: 600, cursor: "pointer" }}
          >
            Volver a intentar
          </button>
        </main>
      </body>
    </html>
  );
}
