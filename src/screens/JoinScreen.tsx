import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from "../lib/roomCode";

const KEYPAD_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function JoinScreen() {
  const navigate = useNavigate();
  const [digits, setDigits] = useState(""); // 0..4 chars, the variable part of ECHO-XXXX
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const code = digits ? `ECHO-${digits.padEnd(4, "_")}` : "ECHO-____";

  const pressDigit = (d: string) => {
    setError(null);
    setDigits((prev) => (prev.length >= 4 ? prev : prev + d));
  };
  const pressBack = () => {
    setError(null);
    setDigits((prev) => prev.slice(0, -1));
  };

  const onCreate = () => {
    const newCode = generateRoomCode();
    sessionStorage.setItem("echo:name", name.trim() || "Host");
    navigate(`/host/${newCode}`);
  };

  const onJoin = () => {
    const cleaned = normalizeRoomCode(`ECHO-${digits}`);
    if (!isValidRoomCode(cleaned)) {
      setError("Enter all 4 digits");
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
      {/* Cascading Echo wordmark — far left. */}
      <h1 className="echo-mark" aria-label="Echo">
        <span className="echo-mark-line">Echo</span>
        <span className="echo-mark-line" aria-hidden="true">Echo</span>
        <span className="echo-mark-line" aria-hidden="true">Echo</span>
        <span className="echo-mark-line" aria-hidden="true">Echo</span>
      </h1>

      {/* Clipboard with just the subject name — center. */}
      <div className="join-center">
        <p className="hero-tag">
          <span className="hero-tag-dot" /> SUBJECT-001 / VOICE CLONING TRIAL
        </p>

        <p className="subtitle">Can your friends tell you from your AI clone?</p>
        <p className="join-blurb">
          Each round, the target answers a question. An AI clone — trained to
          sound exactly like them — takes the same shot. Everyone else votes:
          which answer was real?
        </p>

        <div className="clipboard">
          <div className="clipboard-clip">
            <span className="clipboard-clip-rivet" />
          </div>
          <div className="clipboard-paper">
            <p className="clipboard-header">PROTOCOL · ENROLL SUBJECT</p>

            <label className="field">
              <span>01 · Subject name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bourne"
                maxLength={24}
              />
            </label>

            {error && <p className="error">{error}</p>}

            <div className="actions">
              <button className="btn btn--primary" onClick={onJoin} disabled={digits.length < 4}>
                Enter chamber
              </button>
              <button className="btn btn--ghost" onClick={onCreate}>
                Open new chamber (host)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Steel wall on the right with the keypad mounted on it. */}
      <aside className="steel-wall">
        <span className="steel-wall-screw steel-wall-screw--tl" aria-hidden="true" />
        <span className="steel-wall-screw steel-wall-screw--tr" aria-hidden="true" />
        <span className="steel-wall-screw steel-wall-screw--bl" aria-hidden="true" />
        <span className="steel-wall-screw steel-wall-screw--br" aria-hidden="true" />
        <span className="steel-wall-plate" aria-hidden="true">
          KEYPAD-Ø7 · CHAMBER ACCESS
        </span>

      <div className="keypad">
        <div className="keypad-header">
          <span className="keypad-led" />
          CHAMBER ACCESS
        </div>
        <div className="keypad-screen">
          <span className="keypad-screen-prefix">ECHO–</span>
          <span className="keypad-screen-digits">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={
                  "keypad-screen-digit" +
                  (digits[i] ? " keypad-screen-digit--filled" : "")
                }
              >
                {digits[i] ?? "_"}
              </span>
            ))}
          </span>
        </div>
        <div className="keypad-grid">
          {KEYPAD_DIGITS.map((d) => (
            <button
              key={d}
              type="button"
              className="keypad-key"
              onClick={() => pressDigit(d)}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            className="keypad-key keypad-key--util"
            onClick={pressBack}
            aria-label="Backspace"
          >
            ←
          </button>
          <button
            type="button"
            className="keypad-key"
            onClick={() => pressDigit("0")}
          >
            0
          </button>
          <button
            type="button"
            className="keypad-key keypad-key--enter"
            onClick={onJoin}
            disabled={digits.length < 4 || !name.trim()}
            aria-label="Enter"
          >
            ↵
          </button>
        </div>
      </div>
      </aside>
    </div>
  );
}
