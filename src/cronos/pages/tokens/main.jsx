import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import TokensPage from "./TokensPage.jsx";
import "../../styles/tokens.css";
import "../../styles/dashboard.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <TokensPage />
  </StrictMode>
);
