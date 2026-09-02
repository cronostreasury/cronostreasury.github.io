import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ProtocolsPage from "./ProtocolsPage.jsx";
import "../../styles/tokens.css";
import "../../styles/dashboard.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ProtocolsPage />
  </StrictMode>
);
