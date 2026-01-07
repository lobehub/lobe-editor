import { describe, expect, it, vi } from 'vitest';

import Editor, { resetRandomKey } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { IEditor } from '@/types';

import { TablePlugin } from '../plugin';

describe('table litexml', () => {
  let editor: IEditor;

  beforeEach(() => {
    resetRandomKey();
    editor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, TablePlugin]);
    editor.initNodeEditor();
  });

  it('reader should work', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><root><table id="1" colWidths="187.5,187.5,187.5,187.5"><tr id="2"><td id="3"><span id="4">Name</span></td><td id="5"><span id="6">Age</span></td><td id="7"><span id="8">City</span></td><td id="9"><span id="10">Country</span></td></tr><tr id="11"><td id="12"><span id="13">Alice</span></td><td id="14"><span id="15">25</span></td><td id="16"><span id="17">New York</span></td><td id="18"><span id="19">USA</span></td></tr><tr id="20"><td id="21"><span id="22">Bob</span></td><td id="23"><span id="24">30</span></td><td id="25"><span id="26">London</span></td><td id="27"><span id="28">UK</span></td></tr><tr id="29"><td id="30"><span id="31">Charlie</span></td><td id="32"><span id="33">28</span></td><td id="34"><span id="35">Tokyo</span></td><td id="36"><span id="37">Japan</span></td></tr></table></root>`;
    editor.setDocument('litexml', xml);
    const markdown = editor.getDocument('markdown') as unknown as string;
    expect(markdown).toBe(
      '| Name    | Age | City     | Country |\n' +
        '| :------ | :-- | :------- | :------ |\n' +
        '| Alice   | 25  | New York | USA     |\n' +
        '| Bob     | 30  | London   | UK      |\n' +
        '| Charlie | 28  | Tokyo    | Japan   |\n',
    );
  });

  it('writer should work', () => {
    editor.setDocument(
      'markdown',
      `| Name | Age | City | Country |\n` +
        `|------|-----|------|---------|\n` +
        `| Alice | 25 | New York | USA |\n` +
        `| Bob | 30 | London | UK |\n` +
        `| Charlie | 28 | Tokyo | Japan |\n`,
    );
    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml.replace(/>\n\s*?</g, '><')).toBe(
      `<?xml version="1.0" encoding="UTF-8"?><root><table id="ll63" colWidths="187.5,187.5,187.5,187.5"><tr id="lqqe"><td id="lwap"><span id="m1v0">Name</span></td><td id="m7fb"><span id="mczm">Age</span></td><td id="mijx"><span id="mo48">City</span></td><td id="mtoj"><span id="mz8u">Country</span></td></tr><tr id="n4t5"><td id="nadg"><span id="nfxr">Alice</span></td><td id="nli2"><span id="nr2d">25</span></td><td id="nwmo"><span id="o26z">New York</span></td><td id="o7ra"><span id="odbl">USA</span></td></tr><tr id="oivw"><td id="oog7"><span id="ou0i">Bob</span></td><td id="ozkt"><span id="p554">30</span></td><td id="papf"><span id="pg9q">London</span></td><td id="plu1"><span id="prec">UK</span></td></tr><tr id="pwyn"><td id="q2iy"><span id="q839">Charlie</span></td><td id="qdnk"><span id="qj7v">28</span></td><td id="qos6"><span id="quch">Tokyo</span></td><td id="qzws"><span id="r5h3">Japan</span></td></tr></table></root>`,
    );
  });
});
