import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CronosDashboard from "./CronosDashboard.jsx";
import "./cronos.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CronosDashboard />
  </StrictMode>
);
