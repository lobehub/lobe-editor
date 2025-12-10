import { $isElementNode, LexicalEditor, LexicalNode } from 'lexical';

export function $parseSerializedNodeImpl(serializedNode: any, editor: LexicalEditor): LexicalNode {
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
  const children = serializedNode.children;

  if ($isElementNode(node) && Array.isArray(children)) {
    for (const serializedJSONChildNode of children) {
      const childNode = $parseSerializedNodeImpl(serializedJSONChildNode, editor);
      node.append(childNode);
    }
  }

  return node;
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
