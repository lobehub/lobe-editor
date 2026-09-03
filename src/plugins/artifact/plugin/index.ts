import {
  $generateNodesFromSerializedNodes,
  copyToClipboard,
  type LexicalClipboardData,
} from '@lexical/clipboard';
import type { BaseSelection, DecoratorNode, LexicalEditor, LexicalNode } from 'lexical';
import {
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  COLLABORATION_TAG,
  COMMAND_PRIORITY_HIGH,
  COPY_COMMAND,
  CUT_COMMAND,
  HISTORIC_TAG,
  HISTORY_MERGE_TAG,
  PASTE_COMMAND,
} from 'lexical';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { $isCursorNode, cursorNodeSerialized } from '@/plugins/common/node/cursor';
import { $createHoleNode, $isHoleNode, HoleNode } from '@/plugins/common/node/hole';
import { exportNodeToJSON } from '@/plugins/common/utils';
import { ILitexmlService } from '@/plugins/litexml/service/litexml-service';
import {
  IMarkdownShortCutService,
  MARKDOWN_READER_LEVEL_HIGH,
} from '@/plugins/markdown/service/shortcut';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerArtifactCommand } from '../command';
import { $isArtifactNode, ArtifactNode } from '../node/ArtifactNode';

export interface ArtifactPluginOptions {
  decorator?: (node: ArtifactNode, editor: LexicalEditor) => unknown;
  theme?: string;
}

export const ArtifactPlugin: IEditorPluginConstructor<ArtifactPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<ArtifactPluginOptions>
{
  static pluginName = 'ArtifactPlugin';

  constructor(
    protected kernel: IEditorKernel,
    config?: ArtifactPluginOptions,
  ) {
    super();
    kernel.registerNodes([ArtifactNode]);
    kernel.registerThemes({ artifact: config?.theme || '' });
    this.registerDecorator(
      kernel,
      ArtifactNode.getType(),
      (node: DecoratorNode<unknown>, editor: LexicalEditor) =>
        config?.decorator?.(node as ArtifactNode, editor) ?? null,
    );
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerArtifactCommand(editor));
    this.registerArtifactClipboard(editor);
    this.register(
      editor.registerNodeTransform(ArtifactNode, (node) => {
        wrapArtifactInHole(node);
      }),
    );
    this.registerLiteXml();
    this.registerMarkdown();
    this.registerLegacyArtifactReconciliation(editor);
  }

  private registerArtifactClipboard(editor: LexicalEditor): void {
    const copyArtifactHole = (
      event: ClipboardEvent | KeyboardEvent | null,
      cut: boolean,
    ): boolean => {
      const selection = $getSelection();
      const hole = getAtomicArtifactHole(selection);
      if (!hole) return false;

      const holeKey = hole.getKey();
      const artifact = hole.getContentChildren().find($isArtifactNode);
      const data: LexicalClipboardData = {
        'application/x-lexical-editor': JSON.stringify({
          namespace: editor._config.namespace,
          nodes: [exportNodeToJSON(hole)],
        }),
        'text/plain': artifact?.getTitle() || '',
      };
      const clipboardEvent =
        typeof ClipboardEvent !== 'undefined' && event instanceof ClipboardEvent ? event : null;
      void copyToClipboard(editor, clipboardEvent, data).then((copied) => {
        if (!copied || !cut) return;
        editor.update(() => removeAtomicHole(holeKey));
      });
      return true;
    };

    this.register(
      editor.registerCommand(
        COPY_COMMAND,
        (event) => copyArtifactHole(event, false),
        COMMAND_PRIORITY_HIGH,
      ),
    );
    this.register(
      editor.registerCommand(
        CUT_COMMAND,
        (event) => copyArtifactHole(event, true),
        COMMAND_PRIORITY_HIGH,
      ),
    );
    this.register(
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => pasteArtifactHole(editor, event),
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }

  onDocumentChange(): void {
    this.reconcileLegacyArtifacts();
  }

  private registerLegacyArtifactReconciliation(editor: LexicalEditor): void {
    this.register(
      editor.registerUpdateListener(({ tags }) => {
        if (!tags.has(COLLABORATION_TAG) && !tags.has(HISTORIC_TAG)) return;

        // Yjs applies remote deltas with transforms disabled. Reconcile on the
        // following microtask so legacy Artifact nodes are wrapped once and
        // the migration itself can be synced back to peers.
        queueMicrotask(() => this.reconcileLegacyArtifacts(editor));
      }),
    );
  }

  private reconcileLegacyArtifacts(editor = this.kernel.getLexicalEditor()): void {
    if (!editor) return;

    const artifactKeys = editor.getEditorState().read(() => {
      const keys: string[] = [];
      const visit = (node: LexicalNode) => {
        if ($isArtifactNode(node) && !$isHoleNode(node.getParent())) {
          keys.push(node.getKey());
        }
        if ($isElementNode(node)) {
          node.getChildren().forEach(visit);
        }
      };

      $getRoot().getChildren().forEach(visit);
      return keys;
    });

    if (artifactKeys.length === 0) return;

    editor.update(
      () => {
        artifactKeys.forEach((key) => {
          const node = $getNodeByKey(key);
          if ($isArtifactNode(node)) wrapArtifactInHole(node);
        });
      },
      { tag: HISTORY_MERGE_TAG },
    );
  }

  private registerLiteXml(): void {
    const service = this.kernel.requireService(ILitexmlService);
    if (!service) return;

    service.registerXMLWriter(ArtifactNode.getType(), (node, ctx) => {
      if (!$isArtifactNode(node)) return false;

      // LiteXML writers insert textContent verbatim. Escape the HTML source so
      // that a source document is represented as text instead of becoming part
      // of the surrounding LiteXML document. The parser decodes these entities
      // again, preserving the exact source on the way back into the node.
      return ctx.createXmlNode(
        'artifact',
        { title: node.getTitle() },
        escapeXmlText(node.getHtml()),
      );
    });
    service.registerXMLReader('artifact', (element: Element) =>
      createArtifactHole(
        INodeHelper.createTypeNode(ArtifactNode.getType(), {
          html: element.textContent || '',
          title: element.getAttribute('title') || 'Artifact',
          version: 1,
        }),
      ),
    );
  }

  private registerMarkdown(): void {
    const service = this.kernel.requireService(IMarkdownShortCutService);
    if (!service) return;

    service.registerMarkdownWriter(ArtifactNode.getType(), (ctx, node) => {
      if (!$isArtifactNode(node)) return false;
      const fence = getMarkdownFence(node.getHtml());
      const title = encodeURIComponent(node.getTitle());
      ctx.appendLine(`${fence}artifact title=${title}`);
      ctx.appendLine('\n');
      ctx.appendLine(node.getHtml());
      ctx.appendLine(`\n${fence}\n`);
      return true;
    });
    service.registerMarkdownReader(
      'code',
      (node) => {
        if (node.lang?.toLowerCase() !== 'artifact') return false;
        return createArtifactHole(
          INodeHelper.createTypeNode(ArtifactNode.getType(), {
            html: node.value,
            title: readMarkdownTitle(node.meta),
            version: 1,
          }),
        );
      },
      MARKDOWN_READER_LEVEL_HIGH,
    );
  }
};

/** Wrap one legacy Artifact while preserving its Lexical key and position. */
const wrapArtifactInHole = (node: ArtifactNode): void => {
  const parent = node.getParent();
  if (!parent || $isHoleNode(parent)) return;

  // Keep the Artifact key stable while introducing the transparent Hole
  // around legacy JSON/Yjs content. `replace` detaches the artifact;
  // reinserting it preserves comments and remote references. The payload is
  // inserted between the two cursors created by `$createHoleNode`.
  const hole = $createHoleNode();
  node.replace(hole);
  hole.splice(1, 0, [node]);
};

const getAtomicArtifactHole = (selection: BaseSelection | null): HoleNode | null => {
  if (!selection) return null;

  const selectedNodes = selection.getNodes();
  if ($isNodeSelection(selection) && selectedNodes.length === 1) {
    const selected = selectedNodes[0];
    if ($isHoleNode(selected) && isAtomicArtifactHole(selected)) {
      return selected;
    }
    if ($isArtifactNode(selected)) {
      const hole = selected.getParent();
      if (!$isHoleNode(hole)) return null;
      return isAtomicArtifactHole(hole) ? hole : null;
    }
    return null;
  }

  if (!$isRangeSelection(selection)) return null;
  const artifact = selectedNodes.find($isArtifactNode);
  const hole = artifact?.getParent();
  if (!$isHoleNode(hole) || !hole.hasValidBoundaryCursors()) return null;

  const selectedKeys = new Set(selectedNodes.map((node) => node.getKey()));
  const coversBoundaries =
    selectedKeys.has(hole.getBeforeCursor()!.getKey()) &&
    selectedKeys.has(hole.getAfterCursor()!.getKey());
  const containsOnlyHoleNodes = selectedNodes.every(
    (node) => node.is(hole) || hole.isParentOf(node),
  );
  return coversBoundaries && containsOnlyHoleNodes && isAtomicArtifactHole(hole) ? hole : null;
};

const isAtomicArtifactHole = (hole: HoleNode): boolean => {
  const content = hole.getContentChildren();
  return hole.hasValidBoundaryCursors() && content.length === 1 && $isArtifactNode(content[0]);
};

const removeAtomicHole = (holeKey: string): void => {
  const hole = $getNodeByKey(holeKey);
  if (!$isHoleNode(hole)) return;

  const previous = hole.getPreviousSibling();
  const next = hole.getNextSibling();

  if (next) {
    next.selectStart();
  } else if (previous) {
    previous.selectEnd();
  } else {
    const paragraph = $createParagraphNode();
    hole.insertAfter(paragraph);
    paragraph.selectStart();
  }
  hole.remove();
};

const pasteArtifactHole = (
  editor: LexicalEditor,
  event: ClipboardEvent | InputEvent | KeyboardEvent,
): boolean => {
  const clipboardData = 'clipboardData' in event ? event.clipboardData : null;
  const lexicalJSON = clipboardData?.getData('application/x-lexical-editor');
  if (!clipboardData || !lexicalJSON) return false;

  let serializedNodes: Array<{ type?: unknown }>;
  try {
    const payload = JSON.parse(lexicalJSON) as {
      namespace?: unknown;
      nodes?: Array<{ type?: unknown }>;
    };
    if (payload.namespace !== editor._config.namespace || !Array.isArray(payload.nodes)) {
      return false;
    }
    if (!payload.nodes.some((node) => node.type === 'hole' || node.type === 'artifact')) {
      return false;
    }
    serializedNodes = payload.nodes;
  } catch {
    return false;
  }

  let generated: LexicalNode[];
  try {
    generated = $generateNodesFromSerializedNodes(serializedNodes as any).filter(
      (node) => !$isCursorNode(node),
    );
  } catch {
    // A same-namespace clipboard entry can still be stale or malformed (for
    // example after an app upgrade). Consume it as a no-op instead of letting
    // Lexical report an uncaught parse error or falling through to a generic
    // paste handler with a half-valid runtime Hole.
    event.preventDefault();
    return true;
  }

  let hole: HoleNode;
  if (generated.length === 1 && $isHoleNode(generated[0])) {
    hole = generated[0];
  } else if (generated.length === 1 && $isArtifactNode(generated[0])) {
    hole = $createHoleNode(generated[0]);
  } else {
    event.preventDefault();
    return true;
  }
  if (hole.getContentChildren().length !== 1 || !$isArtifactNode(hole.getContentChildren()[0])) {
    event.preventDefault();
    return true;
  }
  hole.normalizeBoundaryCursors();

  const selection = $getSelection();
  const hasAttachedSelection = (() => {
    try {
      return Boolean(selection?.getNodes().every((node) => node.isAttached()));
    } catch {
      return false;
    }
  })();
  if (!hasAttachedSelection) {
    const root = $getRoot();
    const paragraph = $createParagraphNode();
    root.append(paragraph);
    paragraph.selectEnd();
  }

  event.preventDefault();
  $insertNodes([hole]);
  return true;
};

/** Rehydrate the runtime boundary when importing transparent formats. */
const createArtifactHole = (artifact: ReturnType<typeof INodeHelper.createTypeNode>) =>
  INodeHelper.createElementNode(HoleNode.getType(), {
    children: [{ ...cursorNodeSerialized }, artifact, { ...cursorNodeSerialized }],
  });

const escapeXmlText = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** Use a fence longer than every backtick run in the source HTML. */
const getMarkdownFence = (value: string): string => {
  let longestRun = 0;

  for (const match of value.matchAll(/`+/g)) {
    longestRun = Math.max(longestRun, match[0].length);
  }

  return '`'.repeat(Math.max(3, longestRun + 1));
};

const readMarkdownTitle = (meta: string | null | undefined): string => {
  const match = meta?.match(/(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|(\S*))/);
  const encodedTitle = match?.[1] ?? match?.[2] ?? match?.[3];

  if (encodedTitle === undefined) return 'Artifact';

  try {
    return decodeURIComponent(encodedTitle);
  } catch {
    return encodedTitle;
  }
};
