import {
  $generateJSONFromSelectedNodes,
  $generateNodesFromSerializedNodes,
  $getHtmlContent,
  $insertGeneratedNodes,
  copyToClipboard,
  type LexicalClipboardData,
} from '@lexical/clipboard';
import { mergeRegister } from '@lexical/utils';
import type {
  BaseSelection,
  LexicalEditor,
  LexicalNode,
  NodeSelection,
  SerializedLexicalNode,
} from 'lexical';
import {
  $createNodeSelection,
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isNodeSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  COPY_COMMAND,
  CUT_COMMAND,
  PASTE_COMMAND,
  SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
} from 'lexical';

import { getKernelFromEditor } from '@/editor-kernel/utils';

import { IHoleService } from '../service/i-hole-service';
import { $isCursorNode } from './cursor';
import { $isHoleNode, $readHoleSelectionCoverage, type HoleNode } from './hole';
import { projectRuntimeHolesForJSON } from './hole-serialization';

type SerializedClipboardNode = {
  children?: SerializedClipboardNode[];
  type?: unknown;
  version?: unknown;
  [key: string]: unknown;
};

export interface HoleClipboardTextContext {
  editor: LexicalEditor;
  selection: BaseSelection;
}

export interface HoleClipboardOptions {
  /** Serialize logical content nodes for the text/plain clipboard flavor. */
  serializeTextContent?: (
    nodes: readonly LexicalNode[],
    context: HoleClipboardTextContext,
  ) => string;
}

const getOwningHole = (node: LexicalNode): HoleNode | null => {
  let current: LexicalNode | null = node;
  while (current) {
    if ($isHoleNode(current)) return current;
    current = current.getParent();
  }
  return null;
};

const getLogicalSelectionNodes = (selection: BaseSelection): LexicalNode[] => {
  const nodes: LexicalNode[] = [];
  const seen = new Set<string>();
  const append = (node: LexicalNode): void => {
    if ($isCursorNode(node) && $isHoleNode(node.getParent())) return;
    const key = node.getKey();
    if (seen.has(key)) return;
    seen.add(key);
    nodes.push(node);
  };

  selection.getNodes().forEach((node) => {
    if ($isHoleNode(node)) {
      node.getContentChildren().forEach(append);
    } else {
      append(node);
    }
  });
  return nodes;
};

const getFullySelectedHoles = (selection: BaseSelection): HoleNode[] => {
  const holes = new Map<string, HoleNode>();
  selection.getNodes().forEach((node) => {
    const hole = getOwningHole(node);
    if (hole && $readHoleSelectionCoverage(hole, selection).covered) {
      holes.set(hole.getKey(), hole);
    }
  });
  return [...holes.values()];
};

const expandHoleSelectionForExport = (selection: BaseSelection): BaseSelection => {
  const expanded = selection.clone();
  if (!$isNodeSelection(expanded)) return expanded;

  const addDescendants = (node: LexicalNode): void => {
    expanded.add(node.getKey());
    if ($isElementNode(node)) node.getChildren().forEach(addDescendants);
  };
  getFullySelectedHoles(selection).forEach((hole) => {
    hole.getContentChildren().forEach(addDescendants);
  });
  return expanded;
};

const serializeSelectionToJSON = (
  editor: LexicalEditor,
  selection: BaseSelection,
): string | null => {
  const generated = $generateJSONFromSelectedNodes(editor, selection) as unknown as {
    namespace: string;
    nodes: SerializedClipboardNode[];
  };
  const nodes = generated.nodes.flatMap((node) => {
    return projectRuntimeHolesForJSON(node as unknown as SerializedLexicalNode);
  });
  if (nodes.length === 0) return null;
  return JSON.stringify({
    namespace: generated.namespace,
    nodes,
  });
};

type CreatedClipboardData = {
  data: LexicalClipboardData;
  serializedJSON: string;
};

const createClipboardData = (
  editor: LexicalEditor,
  selection: BaseSelection,
  options: HoleClipboardOptions,
): CreatedClipboardData | null => {
  const exportSelection = expandHoleSelectionForExport(selection);
  const applicationJSON = serializeSelectionToJSON(editor, exportSelection);
  if (!applicationJSON) return null;
  const logicalNodes = getLogicalSelectionNodes(selection);
  const text = options.serializeTextContent
    ? options.serializeTextContent(logicalNodes, { editor, selection })
    : selection.getTextContent();
  return {
    data: {
      'application/x-lexical-editor': applicationJSON,
      'text/html': $getHtmlContent(editor, exportSelection),
      'text/plain': text,
    },
    serializedJSON: applicationJSON,
  };
};

const removeSelectedHoleKeys = (holeKeys: readonly string[]): void => {
  holeKeys.forEach((key) => {
    const hole = $getNodeByKey(key);
    if ($isHoleNode(hole)) hole.remove();
  });
};

const getFullySelectedHoleKeys = (selection: BaseSelection): string[] => {
  return getFullySelectedHoles(selection).map((hole) => hole.getKey());
};

const deleteCapturedSelection = (
  selection: BaseSelection,
  selectedKeys: readonly string[],
  fullySelectedHoleKeys: readonly string[],
): void => {
  if ($isNodeSelection(selection)) {
    const nodeSelection: NodeSelection = $createNodeSelection();
    selectedKeys.forEach((key) => nodeSelection.add(key));
    nodeSelection.deleteNodes();
    return;
  }

  if ($isRangeSelection(selection)) {
    const activeSelection = $getSelection();
    if ($isRangeSelection(activeSelection) && activeSelection.is(selection)) {
      activeSelection.removeText();
    } else {
      selection.removeText();
    }
  }
  removeSelectedHoleKeys(fullySelectedHoleKeys);
};

const readClipboardPayload = (
  editor: LexicalEditor,
  event: ClipboardEvent | InputEvent | KeyboardEvent,
): SerializedClipboardNode[] | null => {
  const clipboardData = 'clipboardData' in event ? event.clipboardData : null;
  const lexicalJSON = clipboardData?.getData('application/x-lexical-editor');
  if (!clipboardData || !lexicalJSON) return null;

  try {
    const payload = JSON.parse(lexicalJSON) as {
      namespace?: unknown;
      nodes?: unknown;
    };
    if (payload.namespace !== editor._config.namespace || !Array.isArray(payload.nodes)) {
      return null;
    }
    const nodes = payload.nodes as SerializedClipboardNode[];
    const containsLegacyHole = nodes.some((node) => node?.type === 'hole');
    return containsLegacyHole ? nodes : null;
  } catch {
    return null;
  }
};

const pasteHoleClipboard = (
  editor: LexicalEditor,
  event: ClipboardEvent | InputEvent | KeyboardEvent,
): boolean => {
  const rawNodes = readClipboardPayload(editor, event);
  if (!rawNodes) return false;

  event.preventDefault();
  const projectedNodes = rawNodes.flatMap((node) =>
    projectRuntimeHolesForJSON(node as unknown as SerializedLexicalNode),
  );
  if (projectedNodes.length === 0) return true;

  let generated: LexicalNode[];
  try {
    generated = $generateNodesFromSerializedNodes(
      projectedNodes as unknown as SerializedLexicalNode[],
    );
  } catch {
    return true;
  }

  let selection = $getSelection();
  const hasAttachedSelection = (() => {
    try {
      return Boolean(selection?.getNodes().every((node) => node.isAttached()));
    } catch {
      return false;
    }
  })();
  if (!selection || !hasAttachedSelection) {
    const paragraph = $createParagraphNode();
    $getRoot().append(paragraph);
    paragraph.selectEnd();
    selection = $getSelection();
  }
  if (!selection) return true;

  $insertGeneratedNodes(editor, generated, selection);
  return true;
};

/**
 * Register transparent Hole copy/cut/paste handlers for one Lexical editor.
 * Registration is intentionally separate from CommonPlugin so the host can
 * decide when the shared clipboard behavior becomes active.
 */
export const registerHoleClipboard = (
  editor: LexicalEditor,
  options: HoleClipboardOptions = {},
): (() => void) => {
  const holeService = getKernelFromEditor(editor)?.requireService(IHoleService);
  const copyOrCut = (event: ClipboardEvent | KeyboardEvent | null, cut: boolean): boolean => {
    const selection = $getSelection();
    if (!selection || getFullySelectedHoles(selection).length === 0) return false;

    const created = createClipboardData(editor, selection, options);
    if (!created) return false;
    const { data, serializedJSON } = created;
    const capturedSelection = selection.clone();
    const selectedKeys = selection.getNodes().map((node) => node.getKey());
    const fullySelectedHoleKeys = getFullySelectedHoleKeys(selection);
    const clipboardEvent = event && 'clipboardData' in event ? (event as ClipboardEvent) : null;
    let copyPromise: Promise<boolean>;
    try {
      copyPromise = copyToClipboard(editor, clipboardEvent, data);
    } catch {
      return true;
    }
    void copyPromise
      .then((copied) => {
        if (!copied || !cut) return;
        editor.update(() => {
          const currentClipboardJSON = serializeSelectionToJSON(
            editor,
            expandHoleSelectionForExport(capturedSelection),
          );
          if (currentClipboardJSON !== serializedJSON) return;
          deleteCapturedSelection(capturedSelection, selectedKeys, fullySelectedHoleKeys);
        });
      })
      .catch(() => undefined);
    return true;
  };

  return mergeRegister(
    editor.registerCommand(
      SELECTION_INSERT_CLIPBOARD_NODES_COMMAND,
      ({ selection }) => {
        holeService?.prepareBoundaryInsertion(selection);
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    ),
    editor.registerCommand(
      COPY_COMMAND,
      (event) => copyOrCut(event, false),
      COMMAND_PRIORITY_CRITICAL,
    ),
    editor.registerCommand(
      CUT_COMMAND,
      (event) => copyOrCut(event, true),
      COMMAND_PRIORITY_CRITICAL,
    ),
    editor.registerCommand(
      PASTE_COMMAND,
      (event) => pasteHoleClipboard(editor, event),
      COMMAND_PRIORITY_CRITICAL,
    ),
  );
};
