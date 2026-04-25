import { useEffect, useState } from "react";

export interface TypewriterResult {
  text: string;
  done: boolean;
}

export function useTypewriter(
  text: string,
  charsPerSec: number,
  resetKey: string,
): TypewriterResult {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
  }, [resetKey]);

  useEffect(() => {
    if (shown >= text.length) return;
    const interval = setInterval(() => {
      setShown((s) => Math.min(s + 1, text.length));
    }, 1000 / charsPerSec);
    return () => clearInterval(interval);
  }, [shown, text.length, charsPerSec]);

  return { text: text.slice(0, shown), done: shown >= text.length };
}
