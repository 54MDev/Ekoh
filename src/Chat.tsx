import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage, ClientMessage } from "./types";

interface Props {
  messages: ChatMessage[];
  myId: string | null;
  send: (msg: ClientMessage) => void;
  placeholder?: string;
  variant?: "rail" | "dock";
}

export default function Chat({ messages, myId, send, placeholder, variant = "rail" }: Props) {
  const [draft, setDraft] = useState("");
  const feedRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the latest message whenever the feed grows.
  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    send({ type: "chat", text });
    setDraft("");
  };

  return (
    <aside className={`chat chat--${variant}`}>
      <div className="chat-header">
        <span className="chat-header-led" />
        COMMS · LIVE FEED
      </div>
      <div className="chat-feed" ref={feedRef}>
        {messages.length === 0 ? (
          <p className="chat-empty">No messages yet. Say something.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={"chat-msg" + (m.fromId === myId ? " chat-msg--me" : "")}
            >
              <span className="chat-msg-name">{m.fromName}</span>
              <span className="chat-msg-text">{m.text}</span>
            </div>
          ))
        )}
      </div>
      <form className="chat-input" onSubmit={onSubmit}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder ?? "Send a message"}
          maxLength={280}
        />
        <button type="submit" className="chat-send" disabled={!draft.trim()} aria-label="Send">
          ↵
        </button>
      </form>
    </aside>
  );
}
