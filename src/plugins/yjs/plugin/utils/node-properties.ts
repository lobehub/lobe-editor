import type { Binding } from '@lexical/yjs';
import type { EditorState, LexicalNode } from 'lexical';

const ignoredNodeProperties = new Set([
  '__cachedText',
  '__first',
  '__key',
  '__last',
  '__next',
  '__parent',
  '__prev',
  '__size',
  '__state',
  '__text',
]);

function shouldIgnoreNodeProperty(property: string, node: LexicalNode, binding: Binding): boolean {
  if (ignoredNodeProperties.has(property) || typeof (node as any)[property] === 'function') {
    return true;
  }

  const excludedProperties = binding.excludedProperties.get(node.constructor as any);
  return Boolean(excludedProperties?.has(property));
}

export function initializeYjsNodeProperties(binding: Binding): void {
  binding.editor.update(
    () => {
      binding.editor._nodes.forEach(({ klass }) => {
        const node = new klass();
        const defaultProperties: Record<string, unknown> = {};

        for (const [property, value] of Object.entries(node)) {
          if (!shouldIgnoreNodeProperty(property, node, binding)) {
            defaultProperties[property] = value;
          }
        }

        binding.nodeProperties.set(node.__type, Object.freeze(defaultProperties));
      });
    },
    { discrete: true },
  );
}

function ensureYjsNodeProperties(binding: Binding, node: LexicalNode): void {
  if (binding.nodeProperties.has(node.__type)) {
    return;
  }

  let defaultNode = node;

  try {
    defaultNode = new (node.constructor as { new (): LexicalNode })();
  } catch {
    defaultNode = node;
  }

  const defaultProperties: Record<string, unknown> = {};

  for (const [property, value] of Object.entries(defaultNode)) {
    if (!shouldIgnoreNodeProperty(property, defaultNode, binding)) {
      defaultProperties[property] = value;
    }
  }

  binding.nodeProperties.set(node.__type, Object.freeze(defaultProperties));
}

export function ensureYjsNodePropertiesFromEditorState(
  binding: Binding,
  editorState: EditorState,
): void {
  editorState.read(() => {
    editorState._nodeMap.forEach((node) => {
      ensureYjsNodeProperties(binding, node);
    });
  });
}
