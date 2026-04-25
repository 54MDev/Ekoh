import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import OpenAI from "openai";

loadEnv(".env");

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Set OPENAI_API_KEY in .env or your shell before running.");
  process.exit(1);
}

const client = new OpenAI({ apiKey });

const prompt =
  process.argv.slice(2).join(" ") ||
  "Pretend you are mimicking a casual texter. Reply to: 'wyd tonight?' in 1-2 sentences.";

console.log("\n--- prompt ---");
console.log(prompt);
console.log("\n--- streaming response ---");

const t0 = Date.now();
let firstTokenAt: number | null = null;
let tokenCount = 0;

const stream = await client.chat.completions.create({
  model: "gpt-4o",
  stream: true,
  messages: [{ role: "user", content: prompt }],
});

for await (const chunk of stream) {
  const token = chunk.choices[0]?.delta?.content;
  if (!token) continue;
  if (firstTokenAt === null) firstTokenAt = Date.now() - t0;
  tokenCount += 1;
  process.stdout.write(token);
}

console.log("\n\n--- stats ---");
console.log(`first token: ${firstTokenAt}ms`);
console.log(`tokens received: ${tokenCount}`);
console.log(`total: ${Date.now() - t0}ms`);

function loadEnv(path: string) {
  try {
    const raw = readFileSync(resolve(process.cwd(), path), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env optional — env vars may already be set in the shell
  }
}
