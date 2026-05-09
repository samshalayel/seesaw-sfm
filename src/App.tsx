import OfficePage   from "./pages/OfficePage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  const path = window.location.pathname;
  if (path === "/settings") return <SettingsPage />;
  return <OfficePage />;
}
