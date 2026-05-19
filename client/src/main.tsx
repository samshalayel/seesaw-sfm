import { createRoot } from "react-dom/client";
import App from "./App";
import OfficePage from "./pages/OfficePage";
import MuseumPanel from "./pages/MuseumPanel";
import "./index.css";

const path = window.location.pathname;

let Page: React.FC;
if (path === "/office")        Page = OfficePage;
else if (path === "/museum-panel") Page = MuseumPanel;
else                           Page = App;

createRoot(document.getElementById("root")!).render(<Page />);
