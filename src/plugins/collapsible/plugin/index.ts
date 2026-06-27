/* eslint-disable @typescript-eslint/no-use-before-define */
import {
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $isDecoratorNode,
  $isElementNode,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_EDITOR,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  LexicalEditor,
  LexicalNode,
  RangeSelection,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';

import { INodeHelper } from '@/editor-kernel/inode/helper';
import { KernelPlugin } from '@/editor-kernel/plugin';
import { $getNearestNodeFromDOMNode } from '@/editor-kernel/utils';
import { ILitexmlService } from '@/plugins/litexml';
import { IMarkdownShortCutService } from '@/plugins/markdown/service/shortcut';
import { INSERT_TABLE_COMMAND } from '@/plugins/table/command';
import type { IEditorKernel, IEditorPlugin, IEditorPluginConstructor } from '@/types';

import { registerCollapsibleCommand } from '../command';
import { $isCollapsibleNode, CollapsibleNode } from '../node/CollapsibleNode';

const COLLAPSIBLE_SELECTOR = '[data-collapsible="true"]';
const CONTENT_SELECTOR = '[data-collapsible-content="true"]';
const TOGGLE_SELECTOR = '[data-collapsible-toggle="true"]';

export interface CollapsiblePluginOptions {
  theme?: {
    collapsible?: string;
  };
}

export const CollapsiblePlugin: IEditorPluginConstructor<CollapsiblePluginOptions> = class
  extends KernelPlugin
  implements IEditorPlugin<CollapsiblePluginOptions>
{
  static pluginName = 'CollapsiblePlugin';

  constructor(
    protected kernel: IEditorKernel,
    public config?: CollapsiblePluginOptions,
  ) {
    super();
    kernel.registerNodes([CollapsibleNode]);
    if (config?.theme) {
      kernel.registerThemes(config.theme);
    }
  }

  onInit(editor: LexicalEditor): void {
    this.register(registerCollapsibleCommand(editor));
    this.register(registerCollapsibleDomBehavior(editor));
    this.register(registerCollapsedSelectionGuard(editor));
    this.register(registerTableInsertionBoundary(editor));
    this.registerMarkdown();
    this.registerLiteXml();
  }

  private registerLiteXml() {
    const litexmlService = this.kernel.requireService(ILitexmlService);
    if (!litexmlService) return;

    litexmlService.registerXMLWriter(CollapsibleNode.getType(), (node, ctx) => {
      if (!$isCollapsibleNode(node)) return false;

      return ctx.createXmlNode('collapsible', {
        collapsed: String(node.isCollapsed()),
        title: node.getTitle(),
      });
    });

    litexmlService.registerXMLReader('collapsible', (xmlNode, children) => {
      const title = xmlNode.getAttribute('title') || 'Details';
      return INodeHelper.createElementNode(CollapsibleNode.getType(), {
        children: ensureTitleChildren(children, title),
        collapsed: xmlNode.getAttribute('collapsed') === 'true',
        title,
      });
    });
  }

  private registerMarkdown() {
    const markdownService = this.kernel.requireService(IMarkdownShortCutService);
    if (!markdownService) return;

    markdownService.registerMarkdownWriter(CollapsibleNode.getType(), (ctx, node) => {
      if (!$isCollapsibleNode(node)) return false;

      ctx.appendLine(`<details${node.isCollapsed() ? '' : ' open'}>\n`);
      ctx.appendLine(`<summary>${escapeHtml(node.getTitle())}</summary>\n\n`);
      node
        .getChildren()
        .slice(1)
        .forEach((child) => ctx.processChild(ctx, child));
      ctx.appendLine('\n</details>\n');
      return true;
    });

    markdownService.registerMarkdownReader('html', (node, children) => {
      const tag = getHtmlTagName(node.value);
      if (tag === 'summary') {
        return INodeHelper.createTypeNode('__collapsible_summary', {
          text: getNodeText(children),
        });
      }

      if (tag !== 'details') return false;

      const summaryNode = children.find((child) => child.type === '__collapsible_summary');
      const contentChildren = children.filter((child) => child.type !== '__collapsible_summary');
      const title =
        summaryNode && 'text' in summaryNode && typeof summaryNode.text === 'string'
          ? summaryNode.text
          : extractSummaryTitle(node.value) || 'Details';

      return INodeHelper.createElementNode(CollapsibleNode.getType(), {
        children: ensureTitleChildren(contentChildren, title),
        collapsed: !/\sopen(?:\s|>|$)/i.test(node.value),
        title,
      });
    });
  }
};

function getHtmlTagName(value: string): string {
  const match = value.match(/^<\/?\s*([\da-z-]+)/i);
  return match?.[1]?.toLowerCase() || '';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function extractSummaryTitle(value: string): string {
  const match = value.match(/<summary\b[^>]*>([\S\s]*?)<\/summary>/i);
  return match?.[1]?.trim() || '';
}

function getNodeText(children: unknown[]): string {
  return children
    .map((child) => {
      if (!child || typeof child !== 'object') return '';
      if ('text' in child && typeof child.text === 'string') return child.text;
      if ('children' in child && Array.isArray(child.children)) {
        return getNodeText(child.children);
      }
      return '';
    })
    .join('');
}

function getCollapsedAncestor(node: LexicalNode): CollapsibleNode | null {
  const collapsible = getCollapsibleAncestor(node);
  return collapsible?.isCollapsed() ? collapsible : null;
}

function getCollapsibleAncestor(node: LexicalNode): CollapsibleNode | null {
  let current: LexicalNode | null = node;
  while (current) {
    if ($isCollapsibleNode(current)) {
      return current;
    }
    current = current.getParent();
  }
  return null;
}

function getTopLevelNode(node: LexicalNode): LexicalNode {
  let current = node;
  let parent = current.getParent();
  while (parent && parent.getKey() !== 'root') {
    current = parent;
    parent = current.getParent();
  }
  return current;
}

function getDirectChildOf(parent: CollapsibleNode, node: LexicalNode): LexicalNode | null {
  let current: LexicalNode | null = node;
  let child: LexicalNode | null = null;
  while (current && current !== parent) {
    child = current;
    current = current.getParent();
  }
  return current === parent ? child : null;
}

function isInsideHiddenChild(collapsible: CollapsibleNode, node: LexicalNode): boolean {
  const directChild = getDirectChildOf(collapsible, node);
  return Boolean(directChild && directChild !== collapsible.getFirstChild());
}

function getDirectChildIndexOf(parent: CollapsibleNode, node: LexicalNode): number {
  const directChild = getDirectChildOf(parent, node);
  return directChild ? directChild.getIndexWithinParent() : -1;
}

function getDirectChildIndexFromSelection(
  collapsible: CollapsibleNode,
  selection: RangeSelection,
): number {
  const focusNode = selection.focus.getNode();
  const directChildIndex = getDirectChildIndexOf(collapsible, focusNode);
  if (directChildIndex >= 0) return directChildIndex;

  if (focusNode === collapsible) {
    return Math.min(selection.focus.offset, collapsible.getChildrenSize() - 1);
  }

  return -1;
}

function selectAfterCollapsedBlock(collapsible: CollapsibleNode): boolean {
  const next = collapsible.getNextSibling();
  if (next) {
    next.selectStart();
    return true;
  }

  const paragraph = $createParagraphNode();
  collapsible.insertAfter(paragraph);
  paragraph.selectStart();
  return true;
}

function selectBeforeBlock(
  collapsible: CollapsibleNode,
  temporaryParagraphKeys?: Set<string>,
): boolean {
  const previous = collapsible.getPreviousSibling();
  if (previous) {
    if ($isDecoratorNode(previous) || previous.getType() === 'code') {
      const paragraph = $createParagraphNode();
      previous.insertAfter(paragraph);
      temporaryParagraphKeys?.add(paragraph.getKey());
      paragraph.selectStart();
      return true;
    }
    previous.selectEnd();
    return true;
  }

  const paragraph = $createParagraphNode();
  collapsible.insertBefore(paragraph);
  paragraph.selectStart();
  return true;
}

function selectCollapsedTitle(collapsible: CollapsibleNode, end = true): boolean {
  const firstChild = collapsible.getFirstChild();
  if (!firstChild) return false;
  if (end) {
    firstChild.selectEnd();
  } else {
    firstChild.selectStart();
  }
  return true;
}

function selectFirstVisibleChild(collapsible: CollapsibleNode): boolean {
  const firstChild = collapsible.getFirstChild();
  if (!firstChild) return false;
  firstChild.selectStart();
  return true;
}

function selectLastVisibleChild(collapsible: CollapsibleNode): boolean {
  if (collapsible.isCollapsed()) {
    return selectCollapsedTitle(collapsible);
  }

  const lastChild = collapsible.getLastChild();
  if (!lastChild) return false;
  lastChild.selectEnd();
  return true;
}

function selectExpandedAdjacentChildOrBlock(
  collapsible: CollapsibleNode,
  childIndex: number,
  isDown: boolean,
  temporaryParagraphKeys?: Set<string>,
): boolean {
  if (childIndex < 0) return false;

  const nextIndex = childIndex + (isDown ? 1 : -1);
  const nextChild = collapsible.getChildAtIndex(nextIndex);
  if (nextChild) {
    if (isDown) {
      nextChild.selectStart();
    } else {
      nextChild.selectEnd();
    }
    return true;
  }

  return isDown
    ? selectAfterCollapsedBlock(collapsible)
    : selectBeforeBlock(collapsible, temporaryParagraphKeys);
}

function moveCollapsibleSelection(
  direction: 'down' | 'up',
  temporaryParagraphKeys?: Set<string>,
): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const focusNode = selection.focus.getNode();
  const collapsible = getCollapsibleAncestor(focusNode);
  if (collapsible) {
    const childIndex = getDirectChildIndexFromSelection(collapsible, selection);
    if (childIndex < 0) return false;

    if (direction === 'down') {
      return collapsible.isCollapsed()
        ? selectAfterCollapsedBlock(collapsible)
        : selectExpandedAdjacentChildOrBlock(
            collapsible,
            childIndex,
            true,
            temporaryParagraphKeys,
          );
    }

    if (collapsible.isCollapsed()) {
      return childIndex > 0
        ? selectCollapsedTitle(collapsible)
        : selectBeforeBlock(collapsible, temporaryParagraphKeys);
    }

    return selectExpandedAdjacentChildOrBlock(
      collapsible,
      childIndex,
      false,
      temporaryParagraphKeys,
    );
  }

  const topLevelNode = getTopLevelNode(focusNode);
  const adjacent =
    direction === 'down' ? topLevelNode.getNextSibling() : topLevelNode.getPreviousSibling();
  if (!$isCollapsibleNode(adjacent)) return false;

  return direction === 'down' ? selectFirstVisibleChild(adjacent) : selectLastVisibleChild(adjacent);
}

function moveCollapsibleSelectionFromDOM(
  editor: LexicalEditor,
  ownerDocument: Document,
  direction: 'down' | 'up',
  temporaryParagraphKeys?: Set<string>,
): boolean {
  const selection = ownerDocument.getSelection();
  const section = getSelectionCollapsibleSection(selection);
  if (!section) return false;

  const collapsible = $getCollapsibleNodeFromSection(section, editor);
  if (!$isCollapsibleNode(collapsible)) return false;

  const childIndex = getDOMSelectionChildIndex(section, selection);
  if (childIndex < 0) return false;

  if (direction === 'down') {
    return collapsible.isCollapsed()
      ? selectAfterCollapsedBlock(collapsible)
      : selectExpandedAdjacentChildOrBlock(
          collapsible,
          childIndex,
          true,
          temporaryParagraphKeys,
        );
  }

  if (collapsible.isCollapsed()) {
    return childIndex > 0
      ? selectCollapsedTitle(collapsible)
      : selectBeforeBlock(collapsible, temporaryParagraphKeys);
  }

  return selectExpandedAdjacentChildOrBlock(
    collapsible,
    childIndex,
    false,
    temporaryParagraphKeys,
  );
}

function getSelectionCollapsibleSection(selection: Selection | null): HTMLElement | null {
  const anchorNode = selection?.anchorNode;
  if (!anchorNode) return null;

  const anchorElement =
    anchorNode instanceof HTMLElement ? anchorNode : anchorNode.parentElement;
  return anchorElement?.closest<HTMLElement>(COLLAPSIBLE_SELECTOR) || null;
}

function getDOMSelectionChildIndex(section: HTMLElement, selection: Selection | null): number {
  const content = section.querySelector<HTMLElement>(CONTENT_SELECTOR);
  const anchorNode = selection?.anchorNode;
  if (!content || !anchorNode) return -1;

  const anchorElement =
    anchorNode instanceof HTMLElement ? anchorNode : anchorNode.parentElement;
  if (!anchorElement || !content.contains(anchorElement)) return -1;

  const directChild = anchorElement.closest<HTMLElement>(`${CONTENT_SELECTOR} > *`);
  if (!directChild) return 0;

  return Array.from(content.children).indexOf(directChild);
}

function $getCollapsibleNodeFromSection(
  section: HTMLElement,
  editor: LexicalEditor,
): CollapsibleNode | null {
  const blockId = section.dataset.blockId;
  const nodeFromBlockId = blockId ? $getNodeByKey(blockId) : null;
  if ($isCollapsibleNode(nodeFromBlockId)) return nodeFromBlockId;

  const nodeFromDOM = $getNearestNodeFromDOMNode(section, editor);
  return $isCollapsibleNode(nodeFromDOM) ? nodeFromDOM : null;
}

function registerCollapsibleDomBehavior(editor: LexicalEditor) {
  const handleMouseDown = (event: MouseEvent) => {
    if (event.defaultPrevented) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest(TOGGLE_SELECTOR)) return;

    const section = target.closest<HTMLElement>(COLLAPSIBLE_SELECTOR);
    if (!section) return;

    const content = section.querySelector<HTMLElement>(CONTENT_SELECTOR);
    if (!content) return;

    const directChild = target.closest<HTMLElement>(`${CONTENT_SELECTOR} > *`);
    let childIndex = 0;

    if (directChild) {
      if (hasNativeCaretTarget(event, directChild)) return;
      childIndex = Array.from(content.children).indexOf(directChild);
      if (childIndex < 0) return;
    }

    event.preventDefault();
    editor.update(() => {
      const node = $getNearestNodeFromDOMNode(section, editor);
      if (!$isCollapsibleNode(node)) return;
      if (node.isCollapsed() && childIndex > 0) return;
      node.getChildAtIndex(childIndex)?.selectStart();
    });
    editor.focus();
  };

  const unregisterRootListener = editor.registerRootListener((rootElement, prevRootElement) => {
    prevRootElement?.removeEventListener('mousedown', handleMouseDown);
    rootElement?.addEventListener('mousedown', handleMouseDown);
  });

  return () => {
    unregisterRootListener();
  };
}

function registerTableInsertionBoundary(editor: LexicalEditor) {
  return editor.registerCommand(
    INSERT_TABLE_COMMAND,
    () => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return false;

      const collapsible = getCollapsibleAncestor(selection.anchor.getNode());
      if (!collapsible) return false;

      const insertionPoint = $createParagraphNode();
      collapsible.insertAfter(insertionPoint);
      insertionPoint.selectStart();
      return false;
    },
    COMMAND_PRIORITY_CRITICAL,
  );
}

function hasNativeCaretTarget(event: MouseEvent, directChild: HTMLElement): boolean {
  const range = getCaretRangeFromPoint(event.clientX, event.clientY);
  const node = range?.startContainer;
  return Boolean(node && directChild.contains(node) && node.textContent);
}

function getCaretRangeFromPoint(x: number, y: number): Range | null {
  if (document.caretRangeFromPoint) {
    return document.caretRangeFromPoint(x, y);
  }

  const caretPosition = document.caretPositionFromPoint?.(x, y);
  if (!caretPosition) return null;

  const range = document.createRange();
  range.setStart(caretPosition.offsetNode, caretPosition.offset);
  range.collapse(true);
  return range;
}

function cleanupTemporaryParagraphs(temporaryParagraphKeys: Set<string>) {
  if (temporaryParagraphKeys.size === 0) return;

  const selection = $getSelection();
  const selectedKeys = new Set<string>();
  if ($isRangeSelection(selection)) {
    const anchorNode = selection.anchor.getNode();
    const focusNode = selection.focus.getNode();
    selectedKeys.add(anchorNode.getKey());
    selectedKeys.add(focusNode.getKey());

    const anchorParent = anchorNode.getParent();
    const focusParent = focusNode.getParent();
    if (anchorParent) selectedKeys.add(anchorParent.getKey());
    if (focusParent) selectedKeys.add(focusParent.getKey());
  }

  for (const key of Array.from(temporaryParagraphKeys)) {
    const node = $getNodeByKey(key);
    if (!node || !$isElementNode(node)) {
      temporaryParagraphKeys.delete(key);
      continue;
    }

    if (node.getTextContent().trim().length > 0) {
      temporaryParagraphKeys.delete(key);
      continue;
    }

    if (selectedKeys.has(key)) continue;

    node.remove();
    temporaryParagraphKeys.delete(key);
  }
}

function registerCollapsedSelectionGuard(editor: LexicalEditor) {
  const temporaryParagraphKeys = new Set<string>();
  let cleanupScheduled = false;
  const scheduleTemporaryParagraphCleanup = () => {
    if (cleanupScheduled) return;
    cleanupScheduled = true;
    queueMicrotask(() => {
      cleanupScheduled = false;
      editor.update(() => {
        cleanupTemporaryParagraphs(temporaryParagraphKeys);
      }, { discrete: true });
    });
  };

  const unregisterSelection = editor.registerCommand(
    SELECTION_CHANGE_COMMAND,
    () => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
        cleanupTemporaryParagraphs(temporaryParagraphKeys);
        return false;
      }

      const focusNode = selection.focus.getNode();
      const collapsible = getCollapsedAncestor(focusNode);
      if (!collapsible || !isInsideHiddenChild(collapsible, focusNode)) {
        cleanupTemporaryParagraphs(temporaryParagraphKeys);
        return false;
      }

      selectCollapsedTitle(collapsible);
      cleanupTemporaryParagraphs(temporaryParagraphKeys);
      return true;
    },
    COMMAND_PRIORITY_EDITOR,
  );

  const unregisterArrowDown = editor.registerCommand<KeyboardEvent>(
    KEY_ARROW_DOWN_COMMAND,
    (event) => {
      if (event.shiftKey) return false;
      if (moveCollapsibleSelection('down', temporaryParagraphKeys)) {
        cleanupTemporaryParagraphs(temporaryParagraphKeys);
        scheduleTemporaryParagraphCleanup();
        event.preventDefault();
        return true;
      }
      return false;
    },
    COMMAND_PRIORITY_CRITICAL,
  );

  const unregisterArrowUp = editor.registerCommand<KeyboardEvent>(
    KEY_ARROW_UP_COMMAND,
    (event) => {
      if (event.shiftKey) return false;
      if (moveCollapsibleSelection('up', temporaryParagraphKeys)) {
        cleanupTemporaryParagraphs(temporaryParagraphKeys);
        scheduleTemporaryParagraphCleanup();
        event.preventDefault();
        return true;
      }
      return false;
    },
    COMMAND_PRIORITY_CRITICAL,
  );

  const handleRootKeyDown = (event: KeyboardEvent) => {
    if (event.shiftKey || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
    if (!isEventForEditorRoot(editor, event)) return;

    let moved = false;
    const ownerDocument = getEventOwnerDocument(event);
    editor.update(() => {
      const direction = event.key === 'ArrowDown' ? 'down' : 'up';
      moved =
        moveCollapsibleSelection(direction, temporaryParagraphKeys) ||
        moveCollapsibleSelectionFromDOM(editor, ownerDocument, direction, temporaryParagraphKeys);
    }, { discrete: true });

    if (!moved) return;

    editor.update(() => {
      cleanupTemporaryParagraphs(temporaryParagraphKeys);
    }, { discrete: true });
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const unregisterRootListener = editor.registerRootListener((rootElement, prevRootElement) => {
    prevRootElement?.ownerDocument.removeEventListener('keydown', handleRootKeyDown, true);
    rootElement?.ownerDocument.addEventListener('keydown', handleRootKeyDown, true);
  });

  return () => {
    unregisterRootListener();
    unregisterSelection();
    unregisterArrowDown();
    unregisterArrowUp();
  };
}

function getEventOwnerDocument(event: KeyboardEvent): Document {
  const target = event.target;
  return target instanceof Node ? target.ownerDocument || document : document;
}

function isEventForEditorRoot(editor: LexicalEditor, event: KeyboardEvent): boolean {
  const rootElement = editor.getRootElement();
  if (!rootElement) return false;

  const target = event.target;
  if (target instanceof Node && rootElement.contains(target)) return true;

  const selection = getEventOwnerDocument(event).getSelection();
  const anchorNode = selection?.anchorNode;
  if (anchorNode && rootElement.contains(anchorNode)) return true;

  const activeElement = getEventOwnerDocument(event).activeElement;
  return Boolean(activeElement && rootElement.contains(activeElement));
}

function ensureTitleChildren(children: any[], title: string): any[] {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return children;

  const firstChildText = getNodeText(children.slice(0, 1)).trim();
  if (firstChildText === trimmedTitle) {
    return children;
  }

  return [
    INodeHelper.createParagraph({
      children: [INodeHelper.createTextNode(title)],
    }),
    ...children,
  ];
}
