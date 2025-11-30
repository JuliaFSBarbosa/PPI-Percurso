"use client";

type LoadingOverlayProps = {
  message?: string;
};

export function LoadingOverlay({ message = "Carregando..." }: LoadingOverlayProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      aria-live="polite"
    >
      <div
        style={{
          background: "rgba(0,0,0,0.8)",
          padding: "20px 24px",
          borderRadius: 16,
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          minWidth: 260,
        }}
      >
        <img
          src="/caminhao.png"
          alt="Caminhão carregando"
          style={{ width: 72, height: "auto" }}
        />
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "4px solid rgba(255,255,255,0.35)",
            borderTopColor: "#fff",
            animation: "spin 0.9s linear infinite",
          }}
        />
        <strong>{message}</strong>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
    </div>
  );
}
