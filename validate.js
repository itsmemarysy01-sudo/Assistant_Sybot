// Normalizes "/content@TeamMarySyBot CREATE" -> { command: "/content", args: ["CREATE"] }
// Returns null for non-commands, or for commands directed at a different bot in a group chat.
export function normalizeCommand(text, botUsername) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;

  const parts = trimmed.split(/\s+/);
  let rawCommand = parts[0];
  const args = parts.slice(1);

  const atIndex = rawCommand.indexOf("@");
  if (atIndex !== -1) {
    const mentioned = rawCommand.slice(atIndex + 1);
    rawCommand = rawCommand.slice(0, atIndex);
    if (botUsername && mentioned.toLowerCase() !== botUsername.toLowerCase()) {
      return null;
    }
  }

  const command = rawCommand.toLowerCase();
  if (command.length <= 1) return null;

  return { command, args };
}

// Validates a map of callback-derived identifiers and returns them coerced to numbers.
// Throws if any value is not a safe integer.
export function validateCallbackIds(ids) {
  const result = {};
  for (const [name, value] of Object.entries(ids)) {
    const num = Number(value);
    if (!Number.isSafeInteger(num)) {
      throw new Error(`Invalid callback identifier: ${name}`);
    }
    result[name] = num;
  }
  return result;
}
