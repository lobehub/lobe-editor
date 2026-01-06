import { describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import { IEditor } from '@/types';

import { TablePlugin } from '../plugin';

describe('table litexml', () => {
  let editor: IEditor;

  beforeEach(() => {
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
      `<?xml version="1.0" encoding="UTF-8"?><root><table id="rglp" colWidths="187.5,187.5,187.5,187.5"><tr id="rm60"><td id="rrqb"><span id="rxam">Name</span></td><td id="s2ux"><span id="s8f8">Age</span></td><td id="sdzj"><span id="sjju">City</span></td><td id="sp45"><span id="suog">Country</span></td></tr><tr id="t08r"><td id="t5t2"><span id="tbdd">Alice</span></td><td id="tgxo"><span id="tmhz">25</span></td><td id="ts2a"><span id="txml">New York</span></td><td id="u36w"><span id="u8r7">USA</span></td></tr><tr id="uebi"><td id="ujvt"><span id="upg4">Bob</span></td><td id="uv0f"><span id="v0kq">30</span></td><td id="v651"><span id="vbpc">London</span></td><td id="vh9n"><span id="vmty">UK</span></td></tr><tr id="vse9"><td id="vxyk"><span id="w3iv">Charlie</span></td><td id="w936"><span id="wenh">28</span></td><td id="wk7s"><span id="wps3">Tokyo</span></td><td id="wvce"><span id="x0wp">Japan</span></td></tr></table></root>`,
    );
  });
});
