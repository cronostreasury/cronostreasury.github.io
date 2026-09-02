import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import YieldsPage from "./YieldsPage.jsx";
import "../../styles/tokens.css";
import "../../styles/dashboard.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <YieldsPage />
  </StrictMode>
);
