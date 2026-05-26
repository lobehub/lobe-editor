import {
  $createNodeSelection,
  $getNodeByKey,
  $isElementNode,
  $isTextNode,
  $setSelection,
  LexicalEditor,
  LexicalNode,
  LexicalNodeConfig,
  ParagraphNode,
} from 'lexical';

import { KernelPlugin } from '@/editor-kernel/plugin';
import { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerBlockMoveCommand } from '../command';
import { BlockMenuService, IBlockMenuService } from '../service';

export interface BlockPluginOptions {
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
    const isRootOrListChainToRoot = (() => {
      let current = typeof latestNode.getParent === 'function' ? latestNode.getParent() : null;

      if (!current || typeof current.getType !== 'function') {
        return false;
      }

      if (current.getType() === 'root') {
        return true;
      }

      while (current && typeof current.getType === 'function') {
        const parentType = current.getType();

        if (parentType === 'root') {
          return true;
        }

        if (parentType !== 'list' && parentType !== 'listitem') {
          return false;
        }

        current = typeof current.getParent === 'function' ? current.getParent() : null;
      }

      return false;
    })();

    const nodeKey = typeof latestNode.getKey === 'function' ? latestNode.getKey() : this.getKey();
    const nodeType = typeof latestNode.getType === 'function' ? latestNode.getType() : '';

    const isRootChildBlock =
      dom &&
      typeof latestNode.isInline === 'function' &&
      !latestNode.isInline() &&
      nodeType !== 'list' &&
      isRootOrListChainToRoot;

    if (isRootChildBlock) {
      dom.dataset.blockId = nodeKey;

      if (attributeName !== 'data-block-id') {
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

    const attributeName = config?.attributeName || 'data-block-id';
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

      const unregisterSelectMenu = blockMenuService.registerMenu({
        key: '__block_default_select',
        label: (context) => context.editor.t('block.select'),
        onClick: (context) => {
          const lexicalEditor = context.editor.getLexicalEditor();
          if (!lexicalEditor) return;

          lexicalEditor.update(() => {
            const target = $getNodeByKey(context.blockId);
            if (!target) return;
            blockMenuService.selectNode(target);
          });
        },
        order: 998,
      });

      const unregisterDeleteMenu = blockMenuService.registerMenu({
        key: '__block_default_delete',
        label: (context) => context.editor.t('block.delete'),
        onClick: (context) => {
          const lexicalEditor = context.editor.getLexicalEditor();
          if (!lexicalEditor) return;

          lexicalEditor.update(() => {
            const target = $getNodeByKey(context.blockId);
            if (!target) return;
            target.remove();
          });
        },
        order: 999,
      });

      this.register(unregisterDefaultSelectHandler);
      this.register(unregisterSelectMenu);
      this.register(unregisterDeleteMenu);
    }

    this.register(registerBlockMoveCommand(editor));
  }
};
