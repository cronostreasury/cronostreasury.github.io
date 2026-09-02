import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import OverviewPage from "./OverviewPage.jsx";
import "../../styles/tokens.css";
import "../../styles/dashboard.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <OverviewPage />
  </StrictMode>
);
