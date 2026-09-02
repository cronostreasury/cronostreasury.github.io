import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import SocialPage from "./SocialPage.jsx";
import "../../styles/tokens.css";
import "../../styles/dashboard.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SocialPage />
  </StrictMode>
);
