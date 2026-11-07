import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app/styles.css";
import { App } from "./app/App";
import { loadRealSites } from "./core";

// Load the real site JSON first (falls back to sample data), then draw the app.
loadRealSites(import.meta.env.BASE_URL).finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
