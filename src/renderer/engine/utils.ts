import type { CSSProperties } from 'react';

export function parseCSSText(cssText: string): CSSProperties {
  const style: Record<string, string> = {};
  for (const part of cssText.split(';')) {
    const colonIndex = part.indexOf(':');
    if (colonIndex === -1) continue;
    const prop = part.slice(0, colonIndex).trim();
    const value = part.slice(colonIndex + 1).trim();
    if (!prop || !value) continue;
    const camelProp = prop.replaceAll(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    style[camelProp] = value;
  }
  return style as CSSProperties;
}
