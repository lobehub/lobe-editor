/**
 * Heuristic: does the content between `$...$` look like a math formula?
 *
 * Positive signals (any one → math):
 *  - LaTeX commands        \alpha  \frac  …
 *  - Structural chars      ^ _ { } ( )
 *  - Operators / relations  + - * / = < > | ! ,
 *  - Digits                0-9
 *  - Single ASCII letter   x  y  n  (common math variable)
 *
 * Everything else (multi-char words, CJK, spaced plain text) → not math.
 */
export function isLikelyMathContent(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;

  // LaTeX commands
  if (/\\[A-Za-z]/.test(trimmed)) return true;

  // Math structural chars, operators, or digits
  if (/[\d!()*+,/<=>^_{|}-]/.test(trimmed)) return true;

  // Single ASCII letter → likely a variable (x, y, n, …)
  if (/^[A-Za-z]$/.test(trimmed)) return true;

  return false;
}
