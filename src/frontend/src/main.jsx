// Entry point: mounts the root <App /> component into index.html's #root element.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Global styles load first so component styles can build on (and override) them.
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  // StrictMode runs extra checks in development to surface bugs early.
  <StrictMode>
    <App />
  </StrictMode>
);
