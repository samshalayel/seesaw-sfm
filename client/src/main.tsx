import { createRoot } from "react-dom/client";
import App from "./App";
import OfficePage from "./pages/OfficePage";
import "./index.css";

const isOfficePage = window.location.pathname === "/office";

createRoot(document.getElementById("root")!).render(
  isOfficePage ? <OfficePage /> : <App />
);
