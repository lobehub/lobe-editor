import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';

import Editor, { moment, resetRandomKey } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import {
  LITEXML_APPLY_COMMAND,
  LITEXML_INSERT_COMMAND,
  LITEXML_MODIFY_COMMAND,
  LitexmlPlugin,
} from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { MathPlugin } from '../plugin';

function getXmlAttribute(xml: string, tagName: string, index: number, attribute: string) {
  const document = new DOMParser().parseFromString(xml, 'text/xml');
  const element = document.getElementsByTagName(tagName).item(index);
  return element?.getAttribute(attribute) ?? null;
}

function getMathCodes(editor: IEditor, tagName: string) {
  const xml = editor.getDocument('litexml') as unknown as string;
  const document = new DOMParser().parseFromString(xml, 'text/xml');
  const elements = document.getElementsByTagName(tagName);
  const codes: string[] = [];

  for (let i = 0; i < elements.length; i++) {
    codes.push(elements.item(i)?.getAttribute('code') ?? '');
  }

  return codes;
}

describe('math litexml', () => {
  let editor: IEditor;

  beforeEach(() => {
    resetRandomKey();
    editor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, MathPlugin]);
    editor.initNodeEditor();
  });

  it('reader should preserve literal dollar signs inside math code', () => {
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root><p id="1"><math id="2" code="$E=mc^2$"></math></p></root>',
    );
    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toBe('$$E=mc^2$$\n');
    const json = editor.getDocument('json') as any;
    expect(json.root.children[0].children[0]).toMatchObject({ code: '$E=mc^2$', type: 'math' });
  });

  it('writer should work', async () => {
    editor.setDocument('markdown', '$$E=mc^2$$');
    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml.replaceAll(/>\n\s*?</g, '><')).toBe(
      `<?xml version="1.0" encoding="UTF-8"?><root><p id="ll63"><math id="lqqe" code="E=mc^2"></math></p></root>`,
    );
  });

  it('serializes raw inline and block math code', () => {
    editor.setDocument(
      'litexml',
      '<root><p><math code="x + y"></math></p><mathBlock code="a^2 + b^2"></mathBlock></root>',
    );

    expect(getMathCodes(editor, 'math')).toEqual(['x + y']);
    expect(getMathCodes(editor, 'mathBlock')).toEqual(['a^2 + b^2']);
  });

  it('preserves raw code across repeated LiteXML roundtrips', () => {
    const inlineCode = '$x$ + \\alpha';
    const blockCode = 'first line\nsecond line';

    editor.setDocument(
      'litexml',
      '<root><p><math code="$x$ + \\alpha"></math></p>' +
        '<mathBlock code="first line&#10;second line"></mathBlock></root>',
    );

    for (let round = 0; round < 3; round++) {
      expect(getMathCodes(editor, 'math')).toEqual([inlineCode]);
      expect(getMathCodes(editor, 'mathBlock')).toEqual([blockCode]);

      const xml = editor.getDocument('litexml') as unknown as string;
      editor.setDocument('litexml', xml);
    }
  });

  it('preserves XML special characters in inline math code', () => {
    const inlineCode = 'x < y && f("a&b")';

    editor.setDocument(
      'litexml',
      '<root><p><math code="x &lt; y &amp;&amp; f(&quot;a&amp;b&quot;)"></math></p></root>',
    );

    expect(getMathCodes(editor, 'math')).toEqual([inlineCode]);
  });

  it('preserves line breaks, carriage returns, and tabs in block math code', () => {
    const blockCode = 'line 1\nline 2\rcolumn\ttab';

    editor.setDocument(
      'litexml',
      '<root><mathBlock code="line 1&#10;line 2&#13;column&#9;tab"></mathBlock></root>',
    );

    const xml = editor.getDocument('litexml') as unknown as string;
    editor.setDocument('litexml', xml);

    expect(getMathCodes(editor, 'mathBlock')).toEqual([blockCode]);
  });

  it('preserves inline formulas when LiteXML rewrites the surrounding paragraph', async () => {
    editor.setDocument('markdown', 'Energy is $E=mc^2$ here\n');
    const sourceXml = editor.getDocument('litexml') as unknown as string;
    const paragraphId = getXmlAttribute(sourceXml, 'p', 0, 'id');
    const mathId = getXmlAttribute(sourceXml, 'math', 0, 'id');
    const formulaCode = getXmlAttribute(sourceXml, 'math', 0, 'code');

    expect(paragraphId).not.toBeNull();
    expect(mathId).not.toBeNull();
    expect(formulaCode).not.toBeNull();

    editor.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: `<p id="${paragraphId}">Work is <math id="${mathId}" code="${formulaCode}"></math> here</p>`,
    });
    await moment();

    expect(editor.getDocument('markdown')).toBe('Work is $E=mc^2$ here\n');
  });

  it('keeps raw math code when applying LiteXML commands', async () => {
    editor.setDocument('litexml', '<root><p><math code="before"></math></p></root>');
    const id = getXmlAttribute(editor.getDocument('litexml') as unknown as string, 'math', 0, 'id');

    expect(id).not.toBeNull();
    editor.dispatchCommand(LITEXML_APPLY_COMMAND, {
      litexml: `<math id="${id}" code="after &amp; &lt;"></math>`,
    });
    await moment();
    expect(getMathCodes(editor, 'math')).toEqual(['after & <']);

    const updatedId = getXmlAttribute(
      editor.getDocument('litexml') as unknown as string,
      'math',
      0,
      'id',
    );
    editor.dispatchCommand(LITEXML_MODIFY_COMMAND, [
      {
        action: 'modify',
        litexml: `<math id="${updatedId}" code="$z$"></math>`,
      },
    ]);
    await moment();
    expect(getMathCodes(editor, 'math')).toEqual(['$z$']);
  });

  it('keeps inserted math code raw when using LITEXML_INSERT_COMMAND', async () => {
    editor.setDocument('litexml', '<root><p><math code="first"></math></p></root>');
    const paragraphId = getXmlAttribute(
      editor.getDocument('litexml') as unknown as string,
      'p',
      0,
      'id',
    );

    expect(paragraphId).not.toBeNull();
    editor.dispatchCommand(LITEXML_INSERT_COMMAND, {
      afterId: paragraphId!,
      litexml: '<p><math code="inserted &amp; raw"></math></p>',
    });
    await moment();

    expect(getMathCodes(editor, 'math')).toEqual(['first', 'inserted & raw']);
  });
});
