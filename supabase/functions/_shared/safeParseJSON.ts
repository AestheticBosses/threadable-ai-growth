/**
 * Robust JSON parser that handles Claude's occasional malformed output.
 * Strips markdown, fixes unquoted keys, extracts embedded JSON objects.
 */
export function safeParseJSON(text: string): any {
  // Remove markdown code blocks if present
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  // Try direct parse first
  try { return JSON.parse(cleaned); } catch { /* continue */ }
  // Fix unquoted keys
  cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  // Fix single-quoted strings
  cleaned = cleaned.replace(/'/g, '"');
  try { return JSON.parse(cleaned); } catch { /* continue */ }
  // Extract JSON object/array
  const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (match) { try { return JSON.parse(match[1]); } catch { /* continue */ } }
  throw new Error('Could not parse JSON: ' + cleaned.substring(0, 200));
}
