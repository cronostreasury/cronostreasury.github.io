import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AnalyticsPage from "./AnalyticsPage.jsx";
import "../../styles/tokens.css";
import "../../styles/dashboard.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AnalyticsPage />
  </StrictMode>
);
