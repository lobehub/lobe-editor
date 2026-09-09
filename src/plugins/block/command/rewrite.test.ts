import { $getRoot, $nodesOfType } from 'lexical';
import { afterEach, describe, expect, it } from 'vitest';

import Editor, { moment } from '@/editor-kernel';
import { BlockRewritePlugin } from '@/plugins/block/plugin/rewrite';
import { ArtifactNode } from '@/plugins/artifact/node/ArtifactNode';
import { ArtifactPlugin } from '@/plugins/artifact/plugin';
import { CodeNode } from '@lexical/code-core';
import { CodeblockPlugin } from '@/plugins/codeblock/plugin';
import { CodemirrorPlugin } from '@/plugins/codemirror-block/plugin';
import { CodeMirrorNode } from '@/plugins/codemirror-block/node/CodeMirrorNode';
import { CommonPlugin } from '@/plugins/common/plugin';
import { $resolveLogicalBlockNode } from '@/plugins/common/node/hole';
import { $getNodeId } from '@/plugins/properties/utils';
import { PropertiesPlugin } from '@/plugins/properties/plugin';

import { APPLY_BLOCK_REWRITE_COMMAND } from './rewrite';
import { hashRewriteText } from '@/utils/rewrite-text';

describe('APPLY_BLOCK_REWRITE_COMMAND', () => {
  let editor: ReturnType<typeof Editor.createEditor>;

  afterEach(() => editor?.destroy());

  it('updates the CodeMirror source and its persisted editor-data projection', async () => {
    editor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      BlockRewritePlugin,
      PropertiesPlugin,
      CodemirrorPlugin,
    ]);
    editor.initHeadlessEditor();
    const source = 'const value = 1;';
    const replacement = 'function quickSort(items) { return items; }';
    editor.setDocument('json', {
      root: {
        children: [
          {
            code: source,
            codeTheme: 'default',
            language: 'javascript',
            options: { indentWithTabs: false, lineNumbers: false, tabSize: 2 },
            type: 'code',
            version: 1,
          },
        ],
        type: 'root',
        version: 1,
      },
    });
    await moment();

    let nodeId = '';
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const firstChild = $getRoot().getFirstChild();
        const node = firstChild ? $resolveLogicalBlockNode(firstChild) : null;
        if (!(node instanceof CodeMirrorNode)) throw new Error('Expected a CodeMirror node.');
        nodeId = $getNodeId(node) || '';
      });
    expect(nodeId).toBeTruthy();

    expect(
      editor.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'codemirror',
        expectedSourceHash: hashRewriteText(source),
        generationId: 'generation-codemirror',
        nodeId,
        output: { kind: 'source', source: replacement },
        requestId: 'request-codemirror',
      }),
    ).toBe(true);
    await moment();

    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const firstChild = $getRoot().getFirstChild();
        const node = firstChild ? $resolveLogicalBlockNode(firstChild) : null;
        expect(node).toBeInstanceOf(CodeMirrorNode);
        expect((node as CodeMirrorNode).code).toBe(replacement);
      });
    expect(JSON.stringify(editor.getDocument('json'))).toContain(replacement);
  });

  it('updates a regular code block source and canonicalizes a language alias', async () => {
    editor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      BlockRewritePlugin,
      PropertiesPlugin,
      CodeblockPlugin,
    ]);
    editor.initHeadlessEditor();
    const source = 'const value = 1;';
    const replacement = 'def quick_sort(items):\n    return items';
    editor.setDocument('json', {
      root: {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: source,
                type: 'code-highlight',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            language: 'javascript',
            textStyle: '',
            theme: '',
            type: 'code',
            version: 1,
          },
        ],
        type: 'root',
        version: 1,
      },
    });
    await moment();

    let nodeId = '';
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const firstChild = $getRoot().getFirstChild();
        const node = firstChild ? $resolveLogicalBlockNode(firstChild) : null;
        if (!(node instanceof CodeNode)) throw new Error('Expected a regular code node.');
        nodeId = $getNodeId(node) || '';
      });
    expect(nodeId).toBeTruthy();

    expect(
      editor.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'codeblock',
        expectedSourceHash: hashRewriteText(source),
        generationId: 'generation-codeblock',
        nodeId,
        output: { kind: 'source', language: ' py ', source: replacement },
        requestId: 'request-codeblock',
      }),
    ).toBe(true);
    await moment();

    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const firstChild = $getRoot().getFirstChild();
        const node = firstChild ? $resolveLogicalBlockNode(firstChild) : null;
        expect(node).toBeInstanceOf(CodeNode);
        expect((node as CodeNode).getTextContent()).toBe(replacement);
        expect((node as CodeNode).getLanguage()).toBe('python');
      });
    const persisted = JSON.stringify(editor.getDocument('json'));
    expect(persisted).toContain('def quick_sort(items):');
    expect(persisted).toContain('"language":"python"');
  });

  it('derives and persists an Artifact title from HTML in the same rewrite transaction', async () => {
    editor = Editor.createEditor().registerPlugins([
      CommonPlugin,
      BlockRewritePlugin,
      PropertiesPlugin,
      ArtifactPlugin,
    ]);
    editor.initHeadlessEditor();
    const source =
      '<!doctype html><html><head><title>Old title</title></head><body><h1>Old title</h1></body></html>';
    const replacement =
      '<!doctype html><html><head><title>俄罗斯方块 &amp; Pro</title></head><body><h1>俄罗斯方块 Pro</h1></body></html>';
    editor.setDocument('json', {
      root: {
        children: [{ html: source, title: 'HTML Artifact', type: 'artifact', version: 1 }],
        type: 'root',
        version: 1,
      },
    });
    await moment();

    let nodeId = '';
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const node = $nodesOfType(ArtifactNode)[0];
        if (!node) throw new Error('Expected an Artifact node.');
        nodeId = $getNodeId(node) || '';
      });
    expect(nodeId).toBeTruthy();

    expect(
      editor.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'artifact',
        expectedSourceHash: hashRewriteText(source),
        generationId: 'generation-artifact-title',
        nodeId,
        output: { kind: 'source', source: replacement },
        requestId: 'request-artifact-title',
      }),
    ).toBe(true);
    await moment();

    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        const node = $nodesOfType(ArtifactNode)[0];
        expect(node?.getTitle()).toBe('俄罗斯方块 & Pro');
      });
    expect(JSON.stringify(editor.getDocument('json'))).toContain('俄罗斯方块 & Pro');

    const explicitSource =
      '<!doctype html><html><head><title>Source title</title></head><body><h1>Source title</h1></body></html>';
    expect(
      editor.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'artifact',
        expectedSourceHash: hashRewriteText(replacement),
        generationId: 'generation-artifact-explicit-title',
        nodeId,
        output: { kind: 'source', source: explicitSource, title: '  Explicit   title  ' },
        requestId: 'request-artifact-explicit-title',
      }),
    ).toBe(true);
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect($nodesOfType(ArtifactNode)[0]?.getTitle()).toBe('Explicit title');
      });

    const noTitleSource = '<!doctype html><html><head></head><body><h1>No title</h1></body></html>';
    expect(
      editor.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'artifact',
        expectedSourceHash: hashRewriteText(explicitSource),
        generationId: 'generation-artifact-no-title',
        nodeId,
        output: { kind: 'source', source: noTitleSource },
        requestId: 'request-artifact-no-title',
      }),
    ).toBe(true);
    await moment();
    editor
      .getLexicalEditor()!
      .getEditorState()
      .read(() => {
        expect($nodesOfType(ArtifactNode)[0]?.getTitle()).toBe('Explicit title');
      });

    const tooLongTitle = 'x'.repeat(256);
    expect(
      editor.dispatchCommand(APPLY_BLOCK_REWRITE_COMMAND, {
        adapterKey: 'artifact',
        expectedSourceHash: hashRewriteText(noTitleSource),
        generationId: 'generation-artifact-too-long-title',
        nodeId,
        output: {
          kind: 'source',
          source: noTitleSource,
          title: tooLongTitle,
        },
        requestId: 'request-artifact-too-long-title',
      }),
    ).toBe(false);
  });
});
