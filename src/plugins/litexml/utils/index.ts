import type { EditorState } from 'lexical';
import {
  $isElementNode,
  LexicalEditor,
  LexicalNode,
  SerializedElementNode,
  SerializedLexicalNode,
} from 'lexical';

export function $parseSerializedNodeImpl(
  serializedNode: any,
  editor: LexicalEditor,
  keepId = false,
  state: EditorState | null = null,
): LexicalNode {
  const type = serializedNode.type;
  const registeredNode = editor._nodes.get(type);

  if (registeredNode === undefined) {
    throw new Error(`parseEditorState: type "${type}" not found`);
  }

  const nodeClass = registeredNode.klass;

  if (serializedNode.type !== nodeClass.getType()) {
    throw new Error(`LexicalNode: Node ${nodeClass.name} does not implement .importJSON().`);
  }

  const node = nodeClass.importJSON(serializedNode);
  if (keepId && serializedNode.id) {
    node.__key = serializedNode.id;
    state?._nodeMap.set(node.__key, node);
  }
  const children = serializedNode.children;

  if ($isElementNode(node) && Array.isArray(children)) {
    for (const serializedJSONChildNode of children) {
      const childNode = $parseSerializedNodeImpl(serializedJSONChildNode, editor, keepId, state);
      node.append(childNode);
    }
  }

  return node;
}

function exportNodeToJSON<SerializedNode extends SerializedLexicalNode>(
  node: LexicalNode,
): SerializedNode {
  const serializedNode = node.exportJSON();
  const nodeClass = node.constructor;

  if (serializedNode.type !== nodeClass.getType()) {
    throw new Error(
      `LexicalNode: Node ${nodeClass.name} does not match the serialized type. Check if .exportJSON() is implemented and it is returning the correct type.`,
    );
  }

  if ($isElementNode(node)) {
    const serializedChildren = (serializedNode as SerializedElementNode).children;
    if (!Array.isArray(serializedChildren)) {
      throw new Error(
        `LexicalNode: Node ${nodeClass.name} is an element but .exportJSON() does not have a children array.`,
      );
    }

    const children = node.getChildren();

    for (const child of children) {
      const serializedChildNode = exportNodeToJSON(child);
      serializedChildren.push(serializedChildNode);
    }
  }

  // @ts-expect-error
  return serializedNode;
}

export function $cloneNode(node: LexicalNode, editor: LexicalEditor): LexicalNode {
  const json = exportNodeToJSON(node);
  return $parseSerializedNodeImpl(json, editor);
}

const maxId = 1_679_616; // 36^4
const startId = 1_000_000; // to avoid short ids
const step = 7211; // a prime number to reduce collisions
const modInverse = 1_394_051; // modular inverse of step mod maxId

export function idToChar(id: string | number): string {
  const nId = (Number(id) * step + startId) % maxId;
  return nId.toString(36).padStart(4, '0');
}

export function charToId(char: string): string {
  const nId = parseInt(char, 36);
  return String(((nId - startId + maxId) * modInverse) % maxId);
}
