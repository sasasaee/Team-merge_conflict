import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app/styles.css";
import { Boot } from "./app/Boot";

// Boot shows the loading screen (moon.riv) while the real site data downloads, then the app.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Boot />
  </StrictMode>,
);