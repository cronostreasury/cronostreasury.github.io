import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ProtocolDetailPage from "./ProtocolDetailPage.jsx";
import { readProtocolSlugFromLocation, restorePrettyProtocolUrl } from "../../lib/slug.js";
import "../../styles/tokens.css";
import "../../styles/dashboard.css";

const slug = readProtocolSlugFromLocation();
const params = new URLSearchParams(window.location.search);
if (slug && params.get("redirect") === "1") {
  restorePrettyProtocolUrl(slug);
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ProtocolDetailPage slug={slug} />
  </StrictMode>
);
