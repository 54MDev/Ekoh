export function generateRoomCode(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `ECHO-${n}`;
}

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidRoomCode(code: string): boolean {
  return /^ECHO-\d{4}$/.test(code);
}
