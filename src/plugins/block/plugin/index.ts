import {
  $getClipboardDataFromSelection,
  copyToClipboard,
  type LexicalClipboardData,
} from '@lexical/clipboard';
import type { LexicalEditor, LexicalNode, LexicalNodeConfig } from 'lexical';
import {
  $createNodeSelection,
  $createRangeSelection,
  $getNodeByKey,
  $isElementNode,
  $isTextNode,
  $setSelection,
  ParagraphNode,
} from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import {
  $resolveLogicalBlockNode,
  $resolveStructuralBlockNode,
} from '@/plugins/common/node/hole';
import { OPEN_ANNOTATION_COMPOSER_COMMAND } from '@/plugins/properties/command';
import { IAnnotationService } from '@/plugins/properties/service';
import { $getNodeId } from '@/plugins/properties/utils';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerBlockMoveCommand } from '../command';
import {
  BLOCK_NODE_ID_ATTRIBUTE,
  BLOCK_ID_ATTRIBUTE,
  BLOCK_STRUCTURAL_ID_ATTRIBUTE,
} from '../constants';
import { BlockMenuService, IBlockMenuService } from '../service';

export interface BlockPluginOptions {
  /**
   * Inline padding reserved on the editor root so the floating block menu /
   * drag handle has somewhere to render without overlapping the block content.
   * Pass `0` (or `'0'`) when the surrounding layout already provides enough
   * left gutter. Accepts a number (treated as px) or any valid CSS
   * `padding-inline` value (e.g. `'40px 0'`). When omitted, defaults to 54px
   * on each side.
   */
  anchorPadding?: number | string;
  attributeName?: string;
  className?: string;
}

type LexicalNodeClass = {
  getType?: () => string;
  prototype: LexicalNode & {
    createDOM?: (config: unknown, editor?: unknown) => HTMLElement;
  };
};

const PATCHED_NODE_TYPES = new Set<string>();

export const getBlockClipboardData = (node: LexicalNode): LexicalClipboardData => {
  const clipboardNode = $resolveStructuralBlockNode(node);

  if ($isElementNode(clipboardNode)) {
    const selection = $createRangeSelection();
    const parent = clipboardNode.getParent();

    if (parent) {
      const index = clipboardNode.getIndexWithinParent();
      selection.anchor.set(parent.getKey(), index, 'element');
      selection.focus.set(parent.getKey(), index + 1, 'element');
    } else {
      selection.anchor.set(clipboardNode.getKey(), 0, 'element');
      selection.focus.set(
        clipboardNode.getKey(),
        clipboardNode.getChildrenSize(),
        'element',
      );
    }

    return $getClipboardDataFromSelection(selection);
  }

  if ($isTextNode(clipboardNode)) {
    const selection = $createRangeSelection();
    selection.setTextNodeRange(
      clipboardNode,
      0,
      clipboardNode,
      clipboardNode.getTextContentSize(),
    );
    return $getClipboardDataFromSelection(selection);
  }

  const selection = $createNodeSelection();
  selection.add(clipboardNode.getKey());
  return $getClipboardDataFromSelection(selection);
};

const selectBlockNode = (node: LexicalNode) => {
  if ($isElementNode(node)) {
    node.select(0, node.getChildrenSize());
    return true;
  }

  if ($isTextNode(node)) {
    node.select(0, node.getTextContentSize());
    return true;
  }

  const selection = $createNodeSelection();
  selection.add(node.getKey());
  $setSelection(selection);
  return true;
};

const getLogicalBlockNodeByKey = (key: string): LexicalNode | null => {
  const node = $getNodeByKey(key);
  return node ? $resolveLogicalBlockNode(node) : null;
};

const resolveNodeClass = (node: LexicalNodeConfig): LexicalNodeClass | null => {
  if (typeof node === 'function') {
    return node as unknown as LexicalNodeClass;
  }

  if (typeof node === 'object' && node && typeof node.replace === 'function') {
    return node.replace as unknown as LexicalNodeClass;
  }

  return null;
};

const patchBlockNodeCreateDOM = (nodeClass: LexicalNodeClass, attributeName: string) => {
  const type = nodeClass.getType?.();
  if (!type || PATCHED_NODE_TYPES.has(type)) {
    return;
  }

  const originCreateDOM = nodeClass.prototype.createDOM;
  if (typeof originCreateDOM !== 'function') {
    return;
  }

  nodeClass.prototype.createDOM = function patchedCreateDOM(config: unknown, editor?: unknown) {
    const dom = originCreateDOM.call(this, config, editor);

    const latestNode = typeof this.getLatest === 'function' ? this.getLatest() : this;
    const parentNode = typeof latestNode.getParent === 'function' ? latestNode.getParent() : null;
    const isBlockChainToEditableRoot = (() => {
      let current = parentNode;

      if (!current || typeof current.getType !== 'function') {
        return false;
      }

      if (current.getType() === 'root' || current.isShadowRoot?.()) {
        return true;
      }

      while (current && typeof current.getType === 'function') {
        const parentType = current.getType();

        if (parentType === 'root' || current.isShadowRoot?.()) {
          return true;
        }

        if (parentType !== 'list' && parentType !== 'listitem') {
          return false;
        }

        current = typeof current.getParent === 'function' ? current.getParent() : null;
      }

      return false;
    })();

    const logicalNode = $resolveLogicalBlockNode(latestNode as LexicalNode);
    const structuralNode = $resolveStructuralBlockNode(latestNode as LexicalNode);
    const nodeKey = logicalNode.getKey();
    const structuralNodeKey = structuralNode.getKey();
    const nodeType = typeof latestNode.getType === 'function' ? latestNode.getType() : '';
    const isCollapsibleTitleChild =
      parentNode?.getType?.() === 'collapsible' &&
      typeof latestNode.getIndexWithinParent === 'function' &&
      latestNode.getIndexWithinParent() === 0;

    const isRootChildBlock =
      dom &&
      typeof latestNode.isInline === 'function' &&
      !latestNode.isInline() &&
      nodeType !== 'list' &&
      isBlockChainToEditableRoot &&
      !isCollapsibleTitleChild;

    if (isRootChildBlock) {
      dom.dataset.blockId = nodeKey;
      dom.setAttribute(BLOCK_STRUCTURAL_ID_ATTRIBUTE, structuralNodeKey);
      const nodeId = $getNodeId(logicalNode);
      if (nodeId) dom.setAttribute(BLOCK_NODE_ID_ATTRIBUTE, nodeId);

      if (attributeName !== BLOCK_ID_ATTRIBUTE) {
        dom.setAttribute(attributeName, nodeKey);
      }
    }

    return dom;
  };

  PATCHED_NODE_TYPES.add(type);
};

export const BlockPlugin: IEditorPluginConstructor<BlockPluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<BlockPluginOptions>
{
  static pluginName = 'BlockPlugin';

  constructor(
    protected kernel: IEditorKernel,
    public config?: BlockPluginOptions,
  ) {
    super();

    const attributeName = config?.attributeName || BLOCK_ID_ATTRIBUTE;
    const rootClassName = config?.className?.trim();

    kernel.registerServiceHotReload(IBlockMenuService, new BlockMenuService());

    if (rootClassName) {
      this.registerRootClassName(kernel, rootClassName);
    }

    // ParagraphNode is built-in and may not flow through kernel.registerNodes.
    patchBlockNodeCreateDOM(ParagraphNode as unknown as LexicalNodeClass, attributeName);

    this.registerNodeTransform(kernel, (node) => {
      const nodeClass = resolveNodeClass(node);
      if (!nodeClass) {
        return node;
      }

      patchBlockNodeCreateDOM(nodeClass, attributeName);
      return node;
    });
  }

  onInit(editor: LexicalEditor): void {
    const blockMenuService = this.kernel.requireService(IBlockMenuService);

    if (blockMenuService) {
      const unregisterDefaultSelectHandler = blockMenuService.registerSelectHandler({
        key: '__block_default_select_handler',
        onSelect: selectBlockNode,
        order: 999,
      });

      const unregisterCopyMenu = blockMenuService.registerMenu({
        key: '__block_default_copy',
        label: (context) => context.editor.t('block.copy'),
        onClick: (context) => {
          const lexicalEditor = context.editor.getLexicalEditor();
          if (!lexicalEditor) return;

          let clipboardData: LexicalClipboardData | undefined;
          lexicalEditor.read(() => {
            const target = getLogicalBlockNodeByKey(context.blockId);
            if (!target) return;
            clipboardData = getBlockClipboardData(target);
          });

          if (clipboardData) {
            void copyToClipboard(lexicalEditor, null, clipboardData);
          }
        },
        order: 998,
      });

      const unregisterSelectMenu = blockMenuService.registerMenu({
        key: '__block_default_select',
        label: (context) => context.editor.t('block.select'),
        onClick: (context) => {
          const lexicalEditor = context.editor.getLexicalEditor();
          if (!lexicalEditor) return;

          lexicalEditor.update(() => {
            const target = getLogicalBlockNodeByKey(context.blockId);
            if (!target) return;
            blockMenuService.selectNode(target);
          });
        },
        order: 997,
      });

      const unregisterCommentMenu = blockMenuService.registerMenu({
        key: '__block_default_comment',
        label: (context) => context.editor.t('block.comment'),
        onClick: (context) => {
          const lexicalEditor = context.editor.getLexicalEditor();
          if (!lexicalEditor) return;

          let quotedText = '';
          let targetKey = '';
          let targetExists = false;
          lexicalEditor.read(() => {
            const target = getLogicalBlockNodeByKey(context.blockId);
            if (!target) return;
            targetExists = true;
            targetKey = target.getKey();
            quotedText = target.getTextContent();
          });
          if (!targetExists) return;

          context.editor.dispatchCommand(OPEN_ANNOTATION_COMPOSER_COMMAND, {
            kind: 'comment',
            nodeKeys: [targetKey],
            payload: null,
            quotedText,
            rect: context.blockElement.getBoundingClientRect(),
          });
        },
        order: 998.5,
        when: (context) =>
          context.editor.isEditable() && Boolean(context.editor.requireService(IAnnotationService)),
      });

      const unregisterDeleteMenu = blockMenuService.registerMenu({
        key: '__block_default_delete',
        label: (context) => context.editor.t('block.delete'),
        onClick: (context) => {
          const lexicalEditor = context.editor.getLexicalEditor();
          if (!lexicalEditor) return;

          lexicalEditor.update(() => {
            const target = getLogicalBlockNodeByKey(context.blockId);
            if (!target) return;
            target.remove();
          });
        },
        order: 999,
      });

      this.register(unregisterDefaultSelectHandler);
      this.register(unregisterCopyMenu);
      this.register(unregisterCommentMenu);
      this.register(unregisterSelectMenu);
      this.register(unregisterDeleteMenu);
    }

    this.register(registerBlockMoveCommand(editor));
  }
};
