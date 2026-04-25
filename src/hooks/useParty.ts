import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import type { ClientMessage, ServerMessage } from "../types";

const HOST = import.meta.env.VITE_PARTYKIT_HOST ?? "localhost:1999";

export interface UsePartyOptions {
  room: string;
  enabled?: boolean;
  onMessage?: (msg: ServerMessage) => void;
}

export interface UsePartyResult {
  send: (msg: ClientMessage) => void;
  connected: boolean;
  socket: PartySocket | null;
}

export function useParty({ room, enabled = true, onMessage }: UsePartyOptions): UsePartyResult {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<PartySocket | null>(null);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!enabled) return;

    const socket = new PartySocket({ host: HOST, room });
    socketRef.current = socket;

    const onOpen = () => setConnected(true);
    const onClose = () => setConnected(false);
    const onMsg = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        handlerRef.current?.(msg);
      } catch {
        // ignore non-JSON frames
      }
    };

    socket.addEventListener("open", onOpen);
    socket.addEventListener("close", onClose);
    socket.addEventListener("message", onMsg);

    return () => {
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("close", onClose);
      socket.removeEventListener("message", onMsg);
      socket.close();
      socketRef.current = null;
    };
  }, [room, enabled]);

  const send = useCallback((msg: ClientMessage) => {
    socketRef.current?.send(JSON.stringify(msg));
  }, []);

  return { send, connected, socket: socketRef.current };
}
