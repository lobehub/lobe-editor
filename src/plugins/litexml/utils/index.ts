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
