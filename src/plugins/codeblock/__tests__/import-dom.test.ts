import { $isCodeNode, CodeNode } from '@lexical/code-core';
import { createEditor } from 'lexical';
import { describe, expect, it } from 'vitest';

import '../plugin';

describe('CodeNode HTML import compatibility', () => {
  it('keeps built-in import rules and guards large pre elements', () => {
    const editor = createEditor({ nodes: [CodeNode] });

    const conversions = CodeNode.importDOM?.();
    expect(conversions).toBeDefined();
    expect(conversions).toHaveProperty('code');
    expect(conversions).toHaveProperty('div');
    expect(conversions).toHaveProperty('table');
    expect(conversions).toHaveProperty('td');
    expect(conversions).toHaveProperty('tr');

    const pre = document.createElement('pre');
    pre.setAttribute('data-language', 'typescript');
    pre.setAttribute('data-theme', 'github-dark');

    const oversizedPre = document.createElement('pre');
    oversizedPre.textContent = 'x'.repeat(8001);

    editor.update(() => {
      const conversion = conversions?.pre?.(pre);
      expect(conversion?.priority).toBe(0);
      const importedNode = conversion?.conversion(pre)?.node;
      expect(Array.isArray(importedNode)).toBe(false);
      if (Array.isArray(importedNode) || !$isCodeNode(importedNode)) {
        throw new Error('Expected a CodeNode from <pre>.');
      }
      expect(importedNode.getLanguage()).toBe('typescript');
      expect(importedNode.getTheme()).toBe('github-dark');

      expect(conversions?.pre?.(oversizedPre)?.conversion(oversizedPre)?.node).toBeNull();
    });
  });
});
