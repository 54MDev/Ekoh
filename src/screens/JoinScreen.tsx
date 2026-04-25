import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from "../lib/roomCode";

export default function JoinScreen() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onCreate = () => {
    const newCode = generateRoomCode();
    sessionStorage.setItem("echo:name", name.trim() || "Host");
    navigate(`/host/${newCode}`);
  };

  const onJoin = () => {
    const cleaned = normalizeRoomCode(code);
    if (!isValidRoomCode(cleaned)) {
      setError("Room code must look like ECHO-1234");
      return;
    }
    if (!name.trim()) {
      setError("Enter a display name");
      return;
    }
    sessionStorage.setItem("echo:name", name.trim());
    navigate(`/play/${cleaned}`);
  };

  return (
    <div className="screen screen--join">
      <h1 className="title">Echo</h1>
      <p className="subtitle">Can the room tell you from your clone?</p>

      <label className="field">
        <span>Your name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bourne"
          maxLength={24}
        />
      </label>

      <label className="field">
        <span>Room code</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ECHO-1234"
          autoCapitalize="characters"
        />
      </label>

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button className="btn btn--primary" onClick={onJoin}>
          Join room
        </button>
        <button className="btn btn--ghost" onClick={onCreate}>
          Create new room (host)
        </button>
      </div>
    </div>
  );
}
