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
      '|Name|Age|City|Country|\n' +
        '|:--|:--|:--|:--|\n' +
        '|Alice|25|New York|USA|\n' +
        '|Bob|30|London|UK|\n' +
        '|Charlie|28|Tokyo|Japan|\n\n',
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
      `<?xml version="1.0" encoding="UTF-8"?><root><table id="39" colWidths="187.5,187.5,187.5,187.5"><tr id="40"><td id="41"><span id="42">Name</span></td><td id="43"><span id="44">Age</span></td><td id="45"><span id="46">City</span></td><td id="47"><span id="48">Country</span></td></tr><tr id="49"><td id="50"><span id="51">Alice</span></td><td id="52"><span id="53">25</span></td><td id="54"><span id="55">New York</span></td><td id="56"><span id="57">USA</span></td></tr><tr id="58"><td id="59"><span id="60">Bob</span></td><td id="61"><span id="62">30</span></td><td id="63"><span id="64">London</span></td><td id="65"><span id="66">UK</span></td></tr><tr id="67"><td id="68"><span id="69">Charlie</span></td><td id="70"><span id="71">28</span></td><td id="72"><span id="73">Tokyo</span></td><td id="74"><span id="75">Japan</span></td></tr></table></root>`,
    );
  });
});
