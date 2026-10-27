import { beforeEach, describe, expect, it } from 'vitest';

import Editor, { resetRandomKey } from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { FilePlugin } from '../plugin';
import { getExtensionFromMimeType, getFileExtension, getFileIconName } from '../utils/meta';

function makeState(children: any[]) {
  return {
    root: {
      children: [
        { children, direction: null, format: '', indent: 0, type: 'paragraph', version: 1 },
      ],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  };
}

function findFiles(json: any): any[] {
  const out: any[] = [];
  const visit = (node: any) => {
    if (node.type === 'file') out.push(node);
    node.children?.forEach(visit);
  };
  visit(json.root);
  return out;
}

describe('file node meta', () => {
  let editor: IEditor;

  const createEditor = () => {
    resetRandomKey();
    editor = Editor.createEditor();
    editor.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, FilePlugin]);
    editor.initNodeEditor();
  };

  beforeEach(() => {
    createEditor();
  });

  it('loads legacy JSON and derives ext from the name', () => {
    editor.setDocument(
      'json',
      makeState([
        {
          fileUrl: 'https://cdn/report.PDF',
          name: 'Report.PDF',
          size: 2048,
          status: 'uploaded',
          type: 'file',
          version: 1,
        },
      ]),
    );

    const [file] = findFiles(editor.getDocument('json'));
    expect(file).toMatchObject({ ext: 'pdf', name: 'Report.PDF', size: 2048, status: 'uploaded' });
    expect(file.mimeType).toBeUndefined();
  });

  it('round-trips mimeType and ext through JSON', () => {
    editor.setDocument(
      'json',
      makeState([
        {
          ext: 'docx',
          fileUrl: 'https://cdn/x',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          name: 'Proposal',
          status: 'uploaded',
          type: 'file',
          version: 1,
        },
      ]),
    );

    expect(findFiles(editor.getDocument('json'))[0]).toMatchObject({
      ext: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      name: 'Proposal',
    });
  });

  it('derives ext from mimeType when the name has no extension', () => {
    editor.setDocument(
      'json',
      makeState([
        {
          fileUrl: 'https://cdn/x',
          mimeType: 'image/png',
          name: 'screenshot',
          status: 'uploaded',
          type: 'file',
          version: 1,
        },
      ]),
    );

    expect(findFiles(editor.getDocument('json'))[0].ext).toBe('png');
  });

  it('round-trips mimeType and ext through LiteXML', () => {
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root><p><file name="data" fileUrl="https://cdn/data" size="10" status="uploaded" mimeType="text/csv" ext="csv"></file></p></root>',
    );

    expect(findFiles(editor.getDocument('json'))[0]).toMatchObject({
      ext: 'csv',
      fileUrl: 'https://cdn/data',
      mimeType: 'text/csv',
      name: 'data',
      size: 10,
    });

    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml).toContain('mimeType="text/csv"');
    expect(xml).toContain('ext="csv"');

    createEditor();
    editor.setDocument('litexml', xml);
    expect(findFiles(editor.getDocument('json'))[0]).toMatchObject({
      ext: 'csv',
      mimeType: 'text/csv',
    });
  });

  it('accepts the kebab-case mime-type attribute', () => {
    editor.setDocument(
      'litexml',
      '<?xml version="1.0" encoding="UTF-8"?><root><p><file name="a.zip" fileUrl="https://cdn/a.zip" status="uploaded" mime-type="application/zip"></file></p></root>',
    );

    expect(findFiles(editor.getDocument('json'))[0]).toMatchObject({
      ext: 'zip',
      mimeType: 'application/zip',
    });
  });

  it('keeps the Markdown link form', () => {
    editor.setDocument(
      'json',
      makeState([
        {
          fileUrl: 'https://cdn/a.pdf',
          name: 'a.pdf',
          status: 'uploaded',
          type: 'file',
          version: 1,
        },
      ]),
    );

    expect(editor.getDocument('markdown')).toBe('[a.pdf](https://cdn/a.pdf)\n');
  });
});

describe('file meta utils', () => {
  it('extracts lower-cased extensions', () => {
    expect(getFileExtension('a.TAR.GZ')).toBe('gz');
    expect(getFileExtension('.env')).toBeUndefined();
    expect(getFileExtension('README')).toBeUndefined();
    expect(getFileExtension('weird.ext with space')).toBeUndefined();
  });

  it('maps mime types to extensions', () => {
    expect(getExtensionFromMimeType('application/pdf; charset=binary')).toBe('pdf');
    expect(getExtensionFromMimeType('application/x-unknown')).toBeUndefined();
  });

  it('builds an icon file name from ext or mime type', () => {
    expect(getFileIconName({ name: 'a.pdf' })).toBe('a.pdf');
    expect(getFileIconName({ ext: 'xlsx', name: 'Budget' })).toBe('Budget.xlsx');
    expect(getFileIconName({ mimeType: 'video/mp4', name: 'clip' })).toBe('clip.mp4');
    expect(getFileIconName({ name: 'clip' })).toBe('clip');
  });
});
