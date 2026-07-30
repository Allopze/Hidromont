/**
 * JS-4 fix: `JSON.stringify` does not escape `<`, so a CMS-editable string
 * value containing the literal substring `</script>` closes an inline
 * `<script type="application/json">` block early — the HTML parser then
 * treats whatever follows as markup, a stored HTML/script-injection
 * breakout. Escaping `<` (as its unicode escape, which JSON.parse resolves
 * back to the original character) neutralizes `</script>`, `<!--`, and any
 * other HTML-significant sequence without changing the decoded value.
 */
export function safeJsonForScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
