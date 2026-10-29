import { $isCodeNode, CodeNode } from '@lexical/code-core';
import { $generateNodesFromDOM } from '@lexical/html';
import { createEditor } from 'lexical';
import { describe, expect, it } from 'vitest';

import '../plugin';

describe('CodeNode HTML import compatibility', () => {
  it('imports multiline pre/code language and theme while rejecting oversized pre blocks', () => {
    const editor = createEditor({ nodes: [CodeNode] });

    const conversions = CodeNode.importDOM?.();
    expect(conversions).toBeDefined();
    expect(conversions).toHaveProperty('code');
    expect(conversions).toHaveProperty('div');
    expect(conversions).toHaveProperty('table');
    expect(conversions).toHaveProperty('td');
    expect(conversions).toHaveProperty('tr');

    editor.update(() => {
      const preDocument = new DOMParser().parseFromString(
        '<pre data-language="typescript" data-theme="github-dark">const one = 1;\nconst two = 2;</pre>',
        'text/html',
      );
      const preCodeNodes = $generateNodesFromDOM(editor, preDocument).filter($isCodeNode);
      expect(preCodeNodes).toHaveLength(1);
      expect(preCodeNodes[0].getLanguage()).toBe('typescript');
      expect(preCodeNodes[0].getTheme()).toBe('github-dark');
      expect(preCodeNodes[0].getTextContent()).toContain('const one = 1;');
      expect(preCodeNodes[0].getTextContent()).toContain('const two = 2;');
      expect(preCodeNodes[0].getTextContent()).toContain('\n');

      const multilineCodeDocument = new DOMParser().parseFromString(
        '<code data-language="typescript" data-theme="github-dark">const three = 3;\nconst four = 4;</code>',
        'text/html',
      );
      const multilineCodeNodes = $generateNodesFromDOM(editor, multilineCodeDocument).filter(
        $isCodeNode,
      );
      expect(multilineCodeNodes).toHaveLength(1);
      expect(multilineCodeNodes[0].getTextContent()).toContain('const four = 4;');

      const oversizedPreDocument = new DOMParser().parseFromString(
        `<pre data-language="typescript">${'x'.repeat(8001)}</pre>`,
        'text/html',
      );
      expect($generateNodesFromDOM(editor, oversizedPreDocument).some($isCodeNode)).toBe(false);
    });
  });
});
