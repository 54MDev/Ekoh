import { Navigate, Route, Routes } from "react-router-dom";
import JoinScreen from "./screens/JoinScreen";
import HostApp from "./host/HostApp";
import PlayerApp from "./screens/PlayerApp";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<JoinScreen />} />
      <Route path="/host/:code" element={<HostApp />} />
      <Route path="/play/:code" element={<PlayerApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
