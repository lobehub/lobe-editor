import {
  $isElementNode,
  LexicalEditor,
  LexicalNode,
  SerializedElementNode,
  SerializedLexicalNode,
} from 'lexical';

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
