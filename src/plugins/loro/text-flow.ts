import type { ElementNode, LexicalNode, TextNode } from 'lexical';
import {
  $createLineBreakNode,
  $createTextNode,
  $isDecoratorNode,
  $isElementNode,
  $isLineBreakNode,
  $isTextNode,
  IS_BOLD,
  IS_CODE,
  IS_HIGHLIGHT,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_SUBSCRIPT,
  IS_SUPERSCRIPT,
  IS_UNDERLINE,
} from 'lexical';
import type { Delta, LoroDoc, LoroText } from 'loro-crdt';

import { $isCursorNode } from '@/plugins/common/node/cursor';
import { $getNodeProperties, $setNodeProperties } from '@/plugins/properties/state';

export const LORO_FORMAT_KEYS = [
  ['bold', IS_BOLD],
  ['italic', IS_ITALIC],
  ['strikethrough', IS_STRIKETHROUGH],
  ['underline', IS_UNDERLINE],
  ['code', IS_CODE],
  ['subscript', IS_SUBSCRIPT],
  ['superscript', IS_SUPERSCRIPT],
  ['highlight', IS_HIGHLIGHT],
  ['lowercase', 1 << 8],
  ['uppercase', 1 << 9],
  ['capitalize', 1 << 10],
] as const;

// Loro 1.16.1 rejects ':' in rich-text style keys. Keep these names stable
// and transport-safe; the namespace is still explicit to avoid collisions.
export const LORO_FORMAT_PREFIX = 'lexical_format_';
export const LORO_STYLE_KEY = 'lexical_style';
export const LORO_DETAIL_KEY = 'lexical_detail';
export const LORO_MODE_KEY = 'lexical_mode';
export const LORO_PROPERTY_PREFIX = 'lexical_property_';
export const LORO_TEXT_PROPERTY_KEYS = [
  'annotationIds',
  'provenance',
  'rewriteGenerationId',
  'rewriteRegionLength',
  'rewriteRegionRequestId',
  'rewriteRegionStart',
  'rewriteRegionStatus',
  'rewriteSessionId',
] as const;

export type LoroTextAttributes = Record<string, unknown>;

export interface LoroFlowDelta {
  attributes?: LoroTextAttributes;
  insert: string;
}

export interface LexicalFlowSnapshot {
  delta: LoroFlowDelta[];
  text: string;
}

export class LoroUnsupportedInlineNodeError extends Error {
  readonly nodeType: string;

  constructor(nodeType: string, message = 'The inline node has no registered durable identity.') {
    super(`${message} type=${nodeType}`);
    this.name = 'LoroUnsupportedInlineNodeError';
    this.nodeType = nodeType;
  }
}

const equalAttributes = (
  left: LoroTextAttributes | undefined,
  right: LoroTextAttributes | undefined,
): boolean => {
  const leftKeys = Object.keys(left ?? {}).sort();
  const rightKeys = Object.keys(right ?? {}).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (key, index) => key === rightKeys[index] && Object.is(left?.[key], right?.[key]),
  );
};

const appendDelta = (delta: LoroFlowDelta[], insert: string, attributes?: LoroTextAttributes) => {
  if (!insert) return;
  const previous = delta.at(-1);
  if (previous && equalAttributes(previous.attributes, attributes)) {
    previous.insert += insert;
    return;
  }
  delta.push({
    insert,
    ...(attributes && Object.keys(attributes).length > 0 ? { attributes } : {}),
  });
};

const textNodeAttributes = (node: TextNode): LoroTextAttributes => {
  const attributes: LoroTextAttributes = {};
  for (const [name, bit] of LORO_FORMAT_KEYS) {
    if (node.getFormat() & bit) attributes[`${LORO_FORMAT_PREFIX}${name}`] = true;
  }
  const style = node.getStyle();
  if (style) attributes[LORO_STYLE_KEY] = style;
  if (node.getDetail() !== 0) attributes[LORO_DETAIL_KEY] = node.getDetail();
  if (node.getMode() !== 'normal') attributes[LORO_MODE_KEY] = node.getMode();
  const properties = $getNodeProperties(node);
  for (const key of LORO_TEXT_PROPERTY_KEYS) {
    if (properties[key] !== undefined) {
      attributes[`${LORO_PROPERTY_PREFIX}${key}`] = JSON.stringify(properties[key]);
    }
  }
  return attributes;
};

const inlineAttributes = (node: LexicalNode): LoroTextAttributes => {
  const properties = $getNodeProperties(node);
  const inlineId = properties.inlineId;
  if (typeof inlineId !== 'string' || inlineId.length === 0) {
    throw new LoroUnsupportedInlineNodeError(node.getType());
  }
  return { [`loro_inline_${inlineId}`]: true };
};

const appendLexicalNode = (
  node: LexicalNode,
  delta: LoroFlowDelta[],
  inheritedAttributes: LoroTextAttributes = {},
): void => {
  if ($isCursorNode(node)) return;
  if ($isTextNode(node)) {
    appendDelta(delta, node.getTextContent(), {
      ...inheritedAttributes,
      ...textNodeAttributes(node),
    });
    return;
  }

  if ($isLineBreakNode(node)) {
    appendDelta(delta, '\n', inheritedAttributes);
    return;
  }

  if ($isDecoratorNode(node)) {
    if (!node.isInline()) {
      throw new LoroUnsupportedInlineNodeError(
        node.getType(),
        'A block DecoratorNode cannot be embedded in a text flow.',
      );
    }
    const properties = $getNodeProperties(node);
    const inlineId = properties.inlineId;
    if (typeof inlineId !== 'string' || inlineId.length === 0) {
      throw new LoroUnsupportedInlineNodeError(node.getType());
    }
    appendDelta(delta, '\uFFFC', {
      ...inheritedAttributes,
      [`loro_atom_${inlineId}`]: true,
    });
    return;
  }

  if ($isElementNode(node)) {
    const nextAttributes = { ...inheritedAttributes, ...inlineAttributes(node) };
    node.getChildren().forEach((child) => appendLexicalNode(child, delta, nextAttributes));
  }
};

/**
 * Read one Lexical flow owner without serializing the editor state. TextNode
 * boundaries are intentionally discarded; the returned Delta is the durable
 * text-flow representation.
 */
export const readLexicalFlow = (owner: ElementNode): LexicalFlowSnapshot => {
  const delta: LoroFlowDelta[] = [];
  owner.getChildren().forEach((child) => {
    if (
      $isTextNode(child) ||
      $isLineBreakNode(child) ||
      (($isElementNode(child) || $isDecoratorNode(child)) && child.isInline())
    ) {
      appendLexicalNode(child, delta);
    }
  });
  return {
    delta,
    text: delta.map((item) => item.insert).join(''),
  };
};

export const readLoroFlow = (text: LoroText): LexicalFlowSnapshot => {
  const delta = text.toDelta() as Delta<string>[];
  const inserts = delta.filter(
    (item): item is Delta<string> & { insert: string } => typeof item.insert === 'string',
  );
  return {
    delta: inserts.map((item) => ({
      attributes: item.attributes as LoroTextAttributes | undefined,
      insert: item.insert,
    })),
    text: text.toString(),
  };
};

/**
 * Configure marks once per document. Loro's rich text is still the CRDT
 * owner; this helper only establishes edge expansion for the fixed Lexical
 * mark schema before mark operations are emitted.
 */
export const configureLoroTextStyles = (doc: LoroDoc, extraKeys: readonly string[] = []): void => {
  const styles: Record<string, { expand: 'after' | 'none' }> = {};
  for (const [name] of LORO_FORMAT_KEYS)
    styles[`${LORO_FORMAT_PREFIX}${name}`] = { expand: 'after' };
  styles[LORO_STYLE_KEY] = { expand: 'after' };
  styles[LORO_DETAIL_KEY] = { expand: 'after' };
  styles[LORO_MODE_KEY] = { expand: 'after' };
  for (const key of LORO_TEXT_PROPERTY_KEYS) {
    styles[`${LORO_PROPERTY_PREFIX}${key}`] = { expand: 'after' };
  }
  for (const key of extraKeys) styles[key] = { expand: 'none' };
  doc.configTextStyle(styles);
};

const allAttributeKeys = (delta: readonly LoroFlowDelta[]): string[] =>
  Array.from(new Set(delta.flatMap((item) => Object.keys(item.attributes ?? {}))));

const attributeAt = (delta: readonly LoroFlowDelta[], offset: number, key: string): unknown => {
  let cursor = 0;
  for (const item of delta) {
    const end = cursor + item.insert.length;
    if (offset < end) return item.attributes?.[key];
    cursor = end;
  }
  return undefined;
};

const markRange = (
  text: LoroText,
  key: string,
  value: unknown,
  start: number,
  end: number,
): void => {
  if (start >= end) return;
  if (value === undefined) text.unmark({ start, end }, key);
  else text.mark({ start, end }, key, value as never);
};

const patchMarksForEqualText = (
  text: LoroText,
  previous: LexicalFlowSnapshot,
  next: LexicalFlowSnapshot,
  nextStart: number,
  nextEnd: number,
  previousStart: number,
): void => {
  const keys = new Set([...allAttributeKeys(previous.delta), ...allAttributeKeys(next.delta)]);
  for (const key of keys) {
    let runStart = nextStart;
    let oldValue = attributeAt(previous.delta, previousStart, key);
    let newValue = attributeAt(next.delta, nextStart, key);
    for (let offset = nextStart + 1; offset <= nextEnd; offset += 1) {
      const nextValue = offset < nextEnd ? attributeAt(next.delta, offset, key) : undefined;
      const oldOffset = previousStart + (offset - nextStart);
      const nextOldValue =
        oldOffset < previousStart + (nextEnd - nextStart)
          ? attributeAt(previous.delta, oldOffset, key)
          : undefined;
      if (nextValue !== newValue || nextOldValue !== oldValue || offset === nextEnd) {
        if (oldValue !== newValue) markRange(text, key, newValue, runStart, offset);
        runStart = offset;
        oldValue = nextOldValue;
        newValue = nextValue;
      }
    }
  }
};

const patchMarksForInsertedText = (
  text: LoroText,
  next: LexicalFlowSnapshot,
  start: number,
  end: number,
): void => {
  const keys = allAttributeKeys(next.delta);
  for (const key of keys) {
    let runStart = start;
    let value = attributeAt(next.delta, start, key);
    for (let offset = start + 1; offset <= end; offset += 1) {
      const nextValue = offset < end ? attributeAt(next.delta, offset, key) : undefined;
      if (nextValue !== value || offset === end) {
        markRange(text, key, value, runStart, offset);
        runStart = offset;
        value = nextValue;
      }
    }
  }
};

interface EqualTextSpan {
  newStart: number;
  oldStart: number;
  length: number;
}

/** A bounded LCS map used only to align mark ranges, never as the CRDT. */
const equalTextSpans = (oldText: string, newText: string): EqualTextSpan[] => {
  const oldLength = oldText.length;
  const newLength = newText.length;
  const cells = oldLength * newLength;
  if (cells > 1_000_000) {
    let prefix = 0;
    while (prefix < oldLength && prefix < newLength && oldText[prefix] === newText[prefix])
      prefix += 1;
    let suffix = 0;
    while (
      suffix < oldLength - prefix &&
      suffix < newLength - prefix &&
      oldText[oldLength - suffix - 1] === newText[newLength - suffix - 1]
    ) {
      suffix += 1;
    }
    return [
      ...(prefix > 0 ? [{ oldStart: 0, newStart: 0, length: prefix }] : []),
      ...(suffix > 0
        ? [{ oldStart: oldLength - suffix, newStart: newLength - suffix, length: suffix }]
        : []),
    ];
  }

  const width = newLength + 1;
  const table = new Uint32Array((oldLength + 1) * width);
  for (let oldIndex = oldLength - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLength - 1; newIndex >= 0; newIndex -= 1) {
      const index = oldIndex * width + newIndex;
      table[index] =
        oldText[oldIndex] === newText[newIndex]
          ? table[(oldIndex + 1) * width + newIndex + 1] + 1
          : Math.max(
              table[(oldIndex + 1) * width + newIndex],
              table[oldIndex * width + newIndex + 1],
            );
    }
  }

  const equalPairs: Array<{ oldIndex: number; newIndex: number }> = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldLength && newIndex < newLength) {
    if (oldText[oldIndex] === newText[newIndex]) {
      equalPairs.push({ oldIndex, newIndex });
      oldIndex += 1;
      newIndex += 1;
    } else if (table[(oldIndex + 1) * width + newIndex] >= table[oldIndex * width + newIndex + 1]) {
      oldIndex += 1;
    } else {
      newIndex += 1;
    }
  }

  const spans: EqualTextSpan[] = [];
  for (const pair of equalPairs) {
    const previous = spans.at(-1);
    if (
      previous &&
      previous.oldStart + previous.length === pair.oldIndex &&
      previous.newStart + previous.length === pair.newIndex
    ) {
      previous.length += 1;
    } else {
      spans.push({ oldStart: pair.oldIndex, newStart: pair.newIndex, length: 1 });
    }
  }
  return spans;
};

/**
 * Apply content and mark changes to one existing LoroText. `LoroText.update`
 * uses Loro's Myers diff and emits text CRDT operations; it is deliberately
 * not a Map LWW replacement or a document JSON write. Marks are then changed
 * as range operations, preserving concurrent rich-text intent.
 */
export const updateLoroFlow = (
  doc: LoroDoc,
  text: LoroText,
  next: LexicalFlowSnapshot,
  previous: LexicalFlowSnapshot = readLoroFlow(text),
): void => {
  configureLoroTextStyles(
    doc,
    allAttributeKeys(next.delta).filter((key) => key.startsWith('loro_')),
  );

  if (previous.text !== next.text) {
    text.update(next.text, { useRefinedDiff: true });
  }

  const spans = equalTextSpans(previous.text, next.text);
  let previousNewEnd = 0;
  let previousOldEnd = 0;
  for (const span of spans) {
    const newGapEnd = span.newStart;
    const oldGapEnd = span.oldStart;
    if (newGapEnd > previousNewEnd) {
      if (oldGapEnd - previousOldEnd === newGapEnd - previousNewEnd) {
        patchMarksForEqualText(text, previous, next, previousNewEnd, newGapEnd, previousOldEnd);
      } else {
        patchMarksForInsertedText(text, next, previousNewEnd, newGapEnd);
      }
    }
    patchMarksForEqualText(
      text,
      previous,
      next,
      span.newStart,
      span.newStart + span.length,
      span.oldStart,
    );
    previousNewEnd = span.newStart + span.length;
    previousOldEnd = span.oldStart + span.length;
  }
  if (previousNewEnd < next.text.length) {
    const oldTailLength = previous.text.length - previousOldEnd;
    const newTailLength = next.text.length - previousNewEnd;
    if (oldTailLength === newTailLength) {
      patchMarksForEqualText(
        text,
        previous,
        next,
        previousNewEnd,
        next.text.length,
        previousOldEnd,
      );
    } else {
      patchMarksForInsertedText(text, next, previousNewEnd, next.text.length);
    }
  }
};

const attributesToFormat = (attributes: LoroTextAttributes | undefined): number => {
  let format = 0;
  for (const [name, bit] of LORO_FORMAT_KEYS) {
    if (attributes?.[`${LORO_FORMAT_PREFIX}${name}`] === true) format |= bit;
  }
  return format;
};

export const assertSupportedFlowAttributes = (
  attributes: LoroTextAttributes | undefined,
  options: { allowInline?: boolean } = {},
): void => {
  for (const key of Object.keys(attributes ?? {})) {
    if (
      key === LORO_STYLE_KEY ||
      key === LORO_DETAIL_KEY ||
      key === LORO_MODE_KEY ||
      key.startsWith(LORO_PROPERTY_PREFIX) ||
      LORO_FORMAT_KEYS.some(([name]) => key === `${LORO_FORMAT_PREFIX}${name}`)
    ) {
      continue;
    }
    if (options.allowInline && (key.startsWith('loro_inline_') || key.startsWith('loro_atom_'))) {
      continue;
    }
    if (key.startsWith('loro_inline_') || key.startsWith('loro_atom_')) {
      throw new LoroUnsupportedInlineNodeError(
        key,
        'This Loro flow contains an inline identity mark without a registered projection adapter.',
      );
    }
    throw new LoroUnsupportedInlineNodeError(key, 'This Loro flow contains an unknown text mark.');
  }
};

export const validateLoroFlowSnapshot = (
  flow: LexicalFlowSnapshot,
  options: { allowInline?: boolean } = {},
): void => {
  flow.delta.forEach((item) => assertSupportedFlowAttributes(item.attributes, options));
};

export const stripInlineFlowAttributes = (
  attributes: LoroTextAttributes | undefined,
): LoroTextAttributes | undefined => {
  if (!attributes) return undefined;
  const result = Object.fromEntries(
    Object.entries(attributes).filter(
      ([key]) => !key.startsWith('loro_inline_') && !key.startsWith('loro_atom_'),
    ),
  );
  return Object.keys(result).length > 0 ? result : undefined;
};

const createTextNodeFromDelta = (insert: string, attributes?: LoroTextAttributes): TextNode => {
  assertSupportedFlowAttributes(attributes);
  const node = $createTextNode(insert);
  node.setFormat(attributesToFormat(attributes));
  const style = attributes?.[LORO_STYLE_KEY];
  if (typeof style === 'string') node.setStyle(style);
  const detail = attributes?.[LORO_DETAIL_KEY];
  if (typeof detail === 'number') node.setDetail(detail);
  const mode = attributes?.[LORO_MODE_KEY];
  if (mode === 'normal' || mode === 'segmented' || mode === 'token') node.setMode(mode);
  const textProperties: Record<string, unknown> = {};
  for (const key of LORO_TEXT_PROPERTY_KEYS) {
    const serialized = attributes?.[`${LORO_PROPERTY_PREFIX}${key}`];
    if (typeof serialized !== 'string') continue;
    try {
      textProperties[key] = JSON.parse(serialized);
    } catch {
      throw new LoroUnsupportedInlineNodeError(
        `${LORO_PROPERTY_PREFIX}${key}`,
        'This Loro flow contains invalid text properties.',
      );
    }
  }
  if (Object.keys(textProperties).length > 0) {
    $setNodeProperties(node, textProperties as never);
  }
  return node;
};

/** Project a flow Delta into Lexical text/linebreak children. */
export const projectLoroFlow = (delta: readonly LoroFlowDelta[]): LexicalNode[] => {
  const nodes: LexicalNode[] = [];
  for (const item of delta) {
    const parts = item.insert.split('\n');
    parts.forEach((part, index) => {
      if (part) nodes.push(createTextNodeFromDelta(part, item.attributes));
      if (index < parts.length - 1) nodes.push($createLineBreakNode());
    });
  }

  return nodes;
};

export const getFlowOwner = (
  node: LexicalNode,
  isFlowOwner: (node: LexicalNode) => node is ElementNode = isDefaultFlowOwner,
): ElementNode | null => {
  let current: LexicalNode | null = node.getParent();
  while (current) {
    if ($isElementNode(current) && isFlowOwner(current)) return current;
    current = current.getParent();
  }
  return null;
};

export const isDefaultFlowOwner = (node: LexicalNode): node is ElementNode => {
  if (!$isElementNode(node)) return false;
  if (node.getType() === 'code') return false;
  if (['paragraph', 'heading', 'listitem'].includes(node.getType())) {
    return node.getChildren().some((child) => $isTextNode(child) || $isLineBreakNode(child));
  }
  return node.getChildren().some((child) => $isTextNode(child) || $isLineBreakNode(child));
};

export const replaceFlowChildren = (owner: ElementNode, delta: readonly LoroFlowDelta[]): void => {
  const children = owner.getChildren();
  const flowChildren = children.filter(
    (child) =>
      $isTextNode(child) ||
      $isLineBreakNode(child) ||
      (($isElementNode(child) || $isDecoratorNode(child)) && child.isInline()),
  );
  const firstIndex =
    flowChildren.length > 0 ? flowChildren[0].getIndexWithinParent() : children.length;
  const projected = projectLoroFlow(delta);
  const reused = new Set<LexicalNode>();
  const next = projected.map((candidate, index) => {
    const existing = flowChildren[index];
    if (
      $isTextNode(candidate) &&
      $isTextNode(existing) &&
      sameTextProjection(candidate, existing)
    ) {
      existing.setTextContent(candidate.getTextContent());
      reused.add(existing);
      return existing;
    }
    if ($isLineBreakNode(candidate) && $isLineBreakNode(existing)) {
      reused.add(existing);
      return existing;
    }
    return candidate;
  });
  for (const child of flowChildren) {
    if (!reused.has(child)) child.remove();
  }
  let insertionIndex = firstIndex;
  for (const candidate of next) {
    const current = owner.getChildAtIndex(insertionIndex);
    if (current?.is(candidate)) {
      insertionIndex += 1;
      continue;
    }
    if (current) current.insertBefore(candidate);
    else owner.append(candidate);
    insertionIndex += 1;
  }
};

const sameTextProjection = (left: TextNode, right: TextNode): boolean =>
  left.getFormat() === right.getFormat() &&
  left.getStyle() === right.getStyle() &&
  left.getDetail() === right.getDetail() &&
  left.getMode() === right.getMode() &&
  JSON.stringify($getNodeProperties(left)) === JSON.stringify($getNodeProperties(right));

export const getFlowOffset = (
  pointNode: LexicalNode,
  pointOffset: number,
  owner: ElementNode,
): number | null => {
  if (!$isTextNode(pointNode) || pointOffset < 0 || pointOffset > pointNode.getTextContentSize()) {
    return null;
  }

  let offset = 0;
  let found = false;
  const visit = (node: LexicalNode): void => {
    if (found) return;
    if (node.is(pointNode)) {
      found = true;
      offset += pointOffset;
      return;
    }
    if ($isTextNode(node)) {
      offset += node.getTextContentSize();
      return;
    }
    if ($isLineBreakNode(node)) {
      offset += 1;
      return;
    }
    if ($isElementNode(node)) node.getChildren().forEach(visit);
  };

  owner.getChildren().forEach(visit);
  return found ? offset : null;
};
