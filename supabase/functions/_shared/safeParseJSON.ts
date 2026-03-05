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

/**
 * Recovers truncated JSON by closing open arrays/objects.
 * Falls back to safeParseJSON first, then attempts structural repair.
 */
export function recoverTruncatedJSON(raw: string): any {
  let cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* continue */ }
  // Fix unquoted keys and single quotes
  cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  cleaned = cleaned.replace(/'/g, '"');
  try { return JSON.parse(cleaned); } catch { /* continue */ }
  // Try to recover truncated JSON
  const lastBrace = cleaned.lastIndexOf('}');
  if (lastBrace > 0) {
    let attempt = cleaned.substring(0, lastBrace + 1);
    const opens = (attempt.match(/\[/g) || []).length;
    const closes = (attempt.match(/\]/g) || []).length;
    for (let i = 0; i < opens - closes; i++) attempt += ']';
    const openBraces = (attempt.match(/\{/g) || []).length;
    const closeBraces = (attempt.match(/\}/g) || []).length;
    for (let i = 0; i < openBraces - closeBraces; i++) attempt += '}';
    try { return JSON.parse(attempt); } catch { /* continue */ }
  }
  // Extract JSON object
  const match = cleaned.match(/(\{[\s\S]*\})/);
  if (match) { try { return JSON.parse(match[1]); } catch { /* continue */ } }
  throw new Error('Could not parse JSON: ' + cleaned.substring(0, 200));
}
