// Entry point: mounts the root <App /> component into index.html's #root element.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  // StrictMode runs extra checks in development to surface bugs early.
  <StrictMode>
    <App />
  </StrictMode>
);
