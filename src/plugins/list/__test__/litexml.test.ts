import { describe, expect, it, vi } from 'vitest';

import Editor, { resetRandomKey } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { IEditor } from '@/types';

import { normalizeOpaqueIds } from '../../litexml/__test__/normalize-opaque-ids';
import { ListPlugin } from '../plugin';

describe('list litexml', () => {
  let editor: IEditor;

  beforeEach(() => {
    resetRandomKey();
    editor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, ListPlugin]);
    editor.initNodeEditor();
  });

  it('reader should work', () => {
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root><ul id="1"><li id="2"><span id="3">asdf</span></li><li id="4"><span id="5">qwer</span></li></ul></root>',
    );
    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toBe('- asdf\n- qwer\n');
  });

  it('writer should work', async () => {
    editor.setDocument('markdown', '- asdf\n- qwer');
    const xml = editor.getDocument('litexml') as unknown as string;
    expect(normalizeOpaqueIds(xml.replace(/>\n\s*?</g, '><'))).toBe(
      normalizeOpaqueIds(
        `<?xml version="1.0" encoding="UTF-8"?><root><ul id="ll63"><li id="lqqe"><span id="lwap">asdf</span></li><li id="m1v0"><span id="m7fb">qwer</span></li></ul></root>`,
      ),
    );
  });

  it('writes check lists with type and checked state', () => {
    editor.setDocument('markdown', '- [ ] todo\n- [x] done\n');
    const xml = editor.getDocument('litexml') as unknown as string;
    const compact = xml.replaceAll(/>\n\s*?</g, '><').replaceAll(/ id="[^"]*"/g, '');
    expect(compact).toContain(
      '<ul type="check"><li checked="false"><span>todo</span></li><li checked="true"><span>done</span></li></ul>',
    );
  });

  it('reads check lists with checked state', () => {
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root><ul type="check"><li checked="false"><span>todo</span></li><li checked="true"><span>done</span></li></ul></root>',
    );
    expect(editor.getDocument('markdown')).toBe('- [ ] todo\n- [x] done\n');
  });

  it('round-trips check lists through litexml and markdown', () => {
    editor.setDocument('markdown', '- [x] first\n- [ ] second\n');
    const xml = editor.getDocument('litexml') as unknown as string;

    const next = Editor.createEditor();
    next.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, ListPlugin]);
    next.initNodeEditor();
    next.setDocument('litexml', xml);

    expect(next.getDocument('markdown')).toBe('- [x] first\n- [ ] second\n');
    const strip = (value: string) => value.replaceAll(/ id="[^"]*"/g, '');
    expect(strip(next.getDocument('litexml') as unknown as string)).toBe(strip(xml));
  });

  it('keeps bullet and ordered lists unchanged', () => {
    editor.setDocument('markdown', '- a\n\n1. b\n');
    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml).toContain('<ul');
    expect(xml).toContain('<ol');
    expect(xml).not.toContain('type=');
    expect(xml).not.toContain('checked=');
  });
});
