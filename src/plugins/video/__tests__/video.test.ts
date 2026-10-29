import { $createParagraphNode, $getRoot, type LexicalNode } from 'lexical';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin } from '@/plugins/common';
import { INodePlugin } from '@/plugins/inode';
import { LitexmlPlugin } from '@/plugins/litexml';
import { MarkdownPlugin } from '@/plugins/markdown';
import type { IEditor } from '@/types';

import { INSERT_VIDEO_COMMAND } from '../command';
import { $createVideoNode, $isVideoNode, VideoNode } from '../node/VideoNode';
import { VideoPlugin, type VideoPluginOptions } from '../plugin';

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?><root>';

let editor: IEditor;

function createEditor(options?: VideoPluginOptions): IEditor {
  const instance = Editor.createEditor();
  instance.registerPlugins([
    INodePlugin,
    LitexmlPlugin,
    MarkdownPlugin,
    CommonPlugin,
    options ? [VideoPlugin, options] : VideoPlugin,
  ]);
  instance.initNodeEditor();
  return instance;
}

function videos(target: IEditor = editor): VideoNode[] {
  const found: VideoNode[] = [];
  target.getLexicalEditor()!.read(() => {
    const walk = (node: LexicalNode) => {
      if ($isVideoNode(node)) found.push(node);
      if ('getChildren' in node && typeof node.getChildren === 'function') {
        (node.getChildren() as LexicalNode[]).forEach(walk);
      }
    };
    walk($getRoot());
  });
  return found;
}

function rootTypes(target: IEditor = editor): string[] {
  let types: string[] = [];
  target.getLexicalEditor()!.read(() => {
    types = $getRoot()
      .getChildren()
      .map((node) => node.getType());
  });
  return types;
}

beforeEach(() => {
  editor = createEditor();
});

describe('video markdown reader', () => {
  it('reads a paired video tag', () => {
    editor.setDocument('markdown', '<video src="https://cdn.test/a.mp4" controls></video>');
    expect(videos().map((v) => v.src)).toEqual(['https://cdn.test/a.mp4']);
    expect(rootTypes()).toEqual(['video']);
  });

  it('reads a self-closed video tag', () => {
    editor.setDocument('markdown', '<video src="https://cdn.test/a.mp4" />');
    expect(videos().map((v) => v.src)).toEqual(['https://cdn.test/a.mp4']);
  });

  it('takes the first source child when src is missing', () => {
    editor.setDocument(
      'markdown',
      '<video controls><source src="https://cdn.test/b.webm" type="video/webm"><source src="https://cdn.test/b.mp4"></video>',
    );
    expect(videos().map((v) => v.src)).toEqual(['https://cdn.test/b.webm']);
    expect(rootTypes()).toEqual(['video']);
  });

  it('reads a multi-line video block with source', () => {
    editor.setDocument(
      'markdown',
      '<video controls>\n  <source src="https://cdn.test/c.mp4" type="video/mp4">\n</video>',
    );
    expect(videos().map((v) => v.src)).toEqual(['https://cdn.test/c.mp4']);
    expect(editor.getDocument('markdown') as unknown as string).not.toContain('<source');
  });

  it('maps attributes and drops autoplay', () => {
    editor.setDocument(
      'markdown',
      '<video src="https://cdn.test/a.mp4" poster="https://cdn.test/p.jpg" title="Walkthrough" style="width: 75%" loop autoplay controls></video>',
    );
    const [video] = videos();
    expect(video.poster).toBe('https://cdn.test/p.jpg');
    expect(video.caption).toBe('Walkthrough');
    expect(video.displayWidth).toBe(75);
    expect(video.loop).toBe(true);
    expect(JSON.stringify(editor.getDocument('json'))).not.toContain('autoplay');
  });

  it('reads a px width attribute as the fixed tier', () => {
    editor.setDocument('markdown', '<video src="https://cdn.test/a.mp4" width="560"></video>');
    const [video] = videos();
    expect(video.fixedWidth).toBe(560);
    expect(video.displayWidth).toBeUndefined();
  });

  it('rejects script urls', () => {
    editor.setDocument('markdown', '<video src="javascript:alert(1)"></video>');
    expect(videos()).toEqual([]);
  });

  it('leaves other html tags to the rest of the chain', () => {
    const markdown =
      'press <kbd>K</kbd> now\n\n<details><summary>More</summary>\n\nBody\n\n</details>';
    const baseline = Editor.createEditor();
    baseline.registerPlugins([INodePlugin, LitexmlPlugin, MarkdownPlugin, CommonPlugin]);
    baseline.initNodeEditor();
    baseline.setDocument('markdown', markdown);
    editor.setDocument('markdown', markdown);
    expect(videos()).toEqual([]);
    expect(editor.getDocument('markdown')).toEqual(baseline.getDocument('markdown'));
  });

  it('drops a stray source tag outside video', () => {
    editor.setDocument('markdown', 'a <source src="https://cdn.test/x.mp4"> b');
    expect(JSON.stringify(editor.getDocument('json'))).not.toContain('__video_source');
  });

  it('does not crash on a source tag outside video without the inode service', () => {
    const bare = Editor.createEditor();
    bare.registerPlugins([LitexmlPlugin, MarkdownPlugin, CommonPlugin, VideoPlugin]);
    bare.initNodeEditor();
    expect(() =>
      bare.setDocument(
        'markdown',
        'Listen <audio controls><source src="https://cdn.test/b.mp3"></audio> now',
      ),
    ).not.toThrow();
    expect(bare.getDocument('markdown') as unknown as string).toContain('Listen');
  });

  it('keeps a bare mp4 link as a link', () => {
    editor.setDocument('markdown', '[clip](https://cdn.test/a.mp4)');
    expect(videos()).toEqual([]);
  });
});

describe('video markdown writer', () => {
  it('writes a minimal video tag', () => {
    editor.setDocument('markdown', '<video src="https://cdn.test/a.mp4"></video>');
    expect((editor.getDocument('markdown') as unknown as string).trim()).toBe(
      '<video src="https://cdn.test/a.mp4" controls></video>',
    );
  });

  it('writes every attribute and round-trips', () => {
    const source =
      '<video src="https://cdn.test/a.mp4" poster="https://cdn.test/p.jpg" title="Cap &quot;one&quot;" style="width: 50%" controls loop></video>';
    editor.setDocument('markdown', source);
    const out = (editor.getDocument('markdown') as unknown as string).trim();
    expect(out).toBe(source);

    const second = createEditor();
    second.setDocument('markdown', out);
    expect(videos(second)[0].caption).toBe('Cap "one"');
  });

  it('writes the px tier as a width attribute', () => {
    editor.setDocument('markdown', '<video src="https://cdn.test/a.mp4" width="480"></video>');
    expect(editor.getDocument('markdown') as unknown as string).toContain('width="480"');
  });
});

describe('video litexml', () => {
  it('round-trips attributes', () => {
    editor.setDocument(
      'litexml',
      `${XML_HEAD}<video src="https://cdn.test/a.mp4" poster="https://cdn.test/p.jpg" caption="Cap" width="1280" height="720" display-width="50" loop="true"></video></root>`,
    );
    const [video] = videos();
    expect(video.src).toBe('https://cdn.test/a.mp4');
    expect(video.width).toBe(1280);
    expect(video.height).toBe(720);
    expect(video.displayWidth).toBe(50);
    expect(video.loop).toBe(true);

    const xml = editor.getDocument('litexml') as unknown as string;
    expect(xml).toContain('src="https://cdn.test/a.mp4"');
    expect(xml).toContain('caption="Cap"');
    expect(xml).toContain('display-width="50"');
    expect(xml).toContain('loop="true"');
  });

  it('round-trips fixed width', () => {
    editor.setDocument(
      'litexml',
      `${XML_HEAD}<video src="https://cdn.test/a.mp4" fixed-width="400"></video></root>`,
    );
    expect(videos()[0].fixedWidth).toBe(400);
    expect(editor.getDocument('litexml') as unknown as string).toContain('fixed-width="400"');
  });
});

describe('video json', () => {
  it('keeps fields through json', () => {
    editor.setDocument(
      'markdown',
      '<video src="https://cdn.test/a.mp4" poster="https://cdn.test/p.jpg" title="Cap" width="320" loop></video>',
    );
    const second = createEditor();
    second.setDocument('json', editor.getDocument('json') as any);
    const [video] = videos(second);
    expect(video.poster).toBe('https://cdn.test/p.jpg');
    expect(video.caption).toBe('Cap');
    expect(video.fixedWidth).toBe(320);
    expect(video.loop).toBe(true);
  });
});

describe('video DOM import/export', () => {
  it('imports a video element', () => {
    const dom = document.createElement('div');
    dom.innerHTML =
      '<video poster="https://cdn.test/p.jpg" style="width: 40%" loop autoplay><source src="https://cdn.test/a.mp4"></video>';
    const element = dom.querySelector('video')!;
    let node: VideoNode | undefined;
    editor.getLexicalEditor()!.update(
      () => {
        const conversion = VideoNode.importDOM()!.video!(element)!;
        node = conversion.conversion(element)!.node as VideoNode;
      },
      { discrete: true },
    );
    expect(node!.src).toBe('https://cdn.test/a.mp4');
    expect(node!.poster).toBe('https://cdn.test/p.jpg');
    expect(node!.displayWidth).toBe(40);
    expect(node!.loop).toBe(true);
  });

  it('imports a figure with a video and figcaption as one captioned node', () => {
    const dom = document.createElement('div');
    dom.innerHTML =
      '<figure><video src="https://cdn.test/a.mp4"></video><figcaption>Cap</figcaption></figure>';
    const figure = dom.querySelector('figure')!;
    let caption: string | undefined;
    let skipsChildren = false;
    editor.getLexicalEditor()!.update(
      () => {
        const output = VideoNode.importDOM()!.figure!(figure)!.conversion(figure)!;
        caption = (output.node as VideoNode).caption;
        skipsChildren = output.forChild?.($createParagraphNode(), null) === null;
      },
      { discrete: true },
    );
    expect(caption).toBe('Cap');
    expect(skipsChildren).toBe(true);
  });

  it('exports a figure with a controls video and caption', () => {
    let html = '';
    editor.getLexicalEditor()!.update(
      () => {
        const node = $createVideoNode({ caption: 'Cap', src: 'https://cdn.test/a.mp4' });
        const { element } = node.exportDOM();
        html = (element as HTMLElement).outerHTML;
      },
      { discrete: true },
    );
    expect(html).toBe(
      '<figure><video src="https://cdn.test/a.mp4" controls=""></video><figcaption>Cap</figcaption></figure>',
    );
  });
});

describe('INSERT_VIDEO_COMMAND', () => {
  it('inserts an empty video for an empty payload', () => {
    editor.setDocument('markdown', 'hello');
    const lexical = editor.getLexicalEditor()!;
    lexical.update(() => $getRoot().selectEnd(), { discrete: true });
    lexical.dispatchCommand(INSERT_VIDEO_COMMAND, {});
    expect(videos().map((v) => v.src)).toEqual(['']);
  });

  it('inserts a video by src', () => {
    editor.setDocument('markdown', 'hello');
    const lexical = editor.getLexicalEditor()!;
    lexical.update(() => $getRoot().selectEnd(), { discrete: true });
    lexical.dispatchCommand(INSERT_VIDEO_COMMAND, { src: 'https://cdn.test/a.mp4' });
    expect(videos().map((v) => v.src)).toEqual(['https://cdn.test/a.mp4']);
  });

  it('uploads a video file and stores the uploaded url', async () => {
    const handleUpload = vi.fn(async () => ({ url: 'https://cdn.test/up.mp4' }));
    const target = createEditor({ handleUpload });
    target.setDocument('markdown', 'hello');
    const lexical = target.getLexicalEditor()!;
    lexical.update(() => $getRoot().selectEnd(), { discrete: true });
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    const handled = lexical.dispatchCommand(INSERT_VIDEO_COMMAND, { file });
    expect(handled).toBe(true);
    expect(videos(target)[0].status).toBe('loading');
    await vi.waitFor(() => expect(videos(target)[0].src).toBe('https://cdn.test/up.mp4'));
    expect(videos(target)[0].status).toBe('uploaded');
  });

  it('ignores non-video files', () => {
    const target = createEditor({ handleUpload: async () => ({ url: 'x' }) });
    const file = new File(['x'], 'pic.png', { type: 'image/png' });
    expect(target.getLexicalEditor()!.dispatchCommand(INSERT_VIDEO_COMMAND, { file })).toBe(false);
  });
});
