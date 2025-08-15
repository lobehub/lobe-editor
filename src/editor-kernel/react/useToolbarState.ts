import { $createCodeNode, $isCodeNode } from '@lexical/code';
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
} from '@lexical/list';
import { $isHeadingNode } from '@lexical/rich-text';
import { $isAtNodeEnd, $setBlocksType } from '@lexical/selection';
import { $findMatchingParent, $getNearestNodeOfType, mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  $isRootOrShadowRoot,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  ElementNode,
  FORMAT_TEXT_COMMAND,
  LexicalEditor,
  LexicalNode,
  REDO_COMMAND,
  RangeSelection,
  SELECTION_CHANGE_COMMAND,
  TextFormatType,
  TextNode,
  UNDO_COMMAND,
} from 'lexical';
import { RefObject, useCallback, useEffect, useState } from 'react';

import { UPDATE_CODEBLOCK_LANG } from '@/plugins/codeblock';
import { $isRootTextContentEmpty } from '@/plugins/common/utils';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@/plugins/link/node/LinkNode';
import { sanitizeUrl } from '@/plugins/link/utils';

import { IEditor } from '../types';

function $findTopLevelElement(node: LexicalNode) {
  let topLevelElement =
    node.getKey() === 'root'
      ? node
      : $findMatchingParent(node, (e) => {
          const parent = e.getParent();
          return parent !== null && $isRootOrShadowRoot(parent);
        });

  if (topLevelElement === null) {
    topLevelElement = node.getTopLevelElementOrThrow();
  }
  return topLevelElement;
}

const formatParagraph = (editor?: LexicalEditor | null) => {
  editor?.update(() => {
    const selection = $getSelection();
    $setBlocksType(selection, () => $createParagraphNode());
  });
};

function getSelectedNode(selection: RangeSelection): TextNode | ElementNode {
  const anchor = selection.anchor;
  const focus = selection.focus;
  const anchorNode = selection.anchor.getNode();
  const focusNode = selection.focus.getNode();
  if (anchorNode === focusNode) {
    return anchorNode;
  }
  const isBackward = selection.isBackward();
  if (isBackward) {
    return $isAtNodeEnd(focus) ? anchorNode : focusNode;
  } else {
    return $isAtNodeEnd(anchor) ? anchorNode : focusNode;
  }
}

/**
 * 提供 toolbar 状态，和 toolbar 方法
 * @returns
 */
export function useToolbarState(editorRef: RefObject<IEditor | null>) {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [isInCodeblock, setIsInCodeblok] = useState(false);
  const [codeblockLang, setCodeblockLang] = useState<string | null | undefined>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [blockType, setBlockType] = useState<string | null>(null);

  const $handleHeadingNode = useCallback(
    (selectedElement: LexicalNode) => {
      const type = $isHeadingNode(selectedElement)
        ? selectedElement.getTag()
        : selectedElement.getType();

      setBlockType(type);
    },
    [setBlockType],
  );

  const $updateToolbar = useCallback(() => {
    const selection = $getSelection();
    const editor = editorRef.current?.getLexicalEditor();

    if (editor) {
      setIsEmpty($isRootTextContentEmpty(editor.isComposing(), false));
    }
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
      setIsStrikethrough(selection.hasFormat('strikethrough'));
      setIsCode(selection.hasFormat('code'));

      const anchorNode = selection.anchor.getNode();
      const focusNode = selection.focus.getNode();
      const element = $findTopLevelElement(anchorNode);
      const focusElement = $findTopLevelElement(focusNode);
      const elementKey = element.getKey();
      const elementDOM = editorRef.current?.getLexicalEditor()?.getElementByKey(elementKey);

      const node = getSelectedNode(selection);
      const parent = node.getParent();
      setIsLink($isLinkNode(parent) || $isLinkNode(node));
      const isCodeBlock =
        $isCodeNode(element) && $isCodeNode(focusElement) && elementKey === focusElement.getKey();
      setIsInCodeblok(isCodeBlock);
      setCodeblockLang(isCodeBlock ? element.getLanguage() : '');

      if (elementDOM !== null) {
        if ($isListNode(element)) {
          const parentList = $getNearestNodeOfType<ListNode>(anchorNode, ListNode);
          const type = parentList ? parentList.getListType() : element.getListType();

          setBlockType(type);
        } else {
          $handleHeadingNode(element);
        }
      }
    }
  }, [editorRef.current]);

  const undo = useCallback(() => {
    editorRef.current?.dispatchCommand(UNDO_COMMAND, undefined);
  }, [editorRef.current]);

  const redo = useCallback(() => {
    editorRef.current?.dispatchCommand(REDO_COMMAND, undefined);
  }, [editorRef.current]);

  const formatText = useCallback(
    (type: TextFormatType) => {
      editorRef.current?.dispatchCommand(FORMAT_TEXT_COMMAND, type);
    },
    [editorRef.current],
  );

  const bold = useCallback(() => {
    formatText('bold');
  }, [formatText]);

  const underline = useCallback(() => {
    formatText('underline');
  }, [formatText]);

  const strikethrough = useCallback(() => {
    formatText('strikethrough');
  }, [formatText]);

  const italic = useCallback(() => {
    formatText('italic');
  }, [formatText]);

  const code = useCallback(() => {
    formatText('code');
  }, [formatText]);

  const bulletList = useCallback(() => {
    if (blockType !== 'bullet') {
      editorRef.current?.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else {
      formatParagraph(editorRef.current?.getLexicalEditor());
    }
  }, [blockType]);

  const numberList = useCallback(() => {
    if (blockType !== 'number') {
      editorRef.current?.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    } else {
      formatParagraph(editorRef.current?.getLexicalEditor());
    }
  }, [blockType]);

  const formatCodeblock = useCallback(() => {
    if (blockType !== 'code') {
      editorRef.current?.getLexicalEditor()?.update(() => {
        let selection = $getSelection();
        if (!selection) {
          return;
        }
        if (!$isRangeSelection(selection) || selection.isCollapsed()) {
          $setBlocksType(selection, () => $createCodeNode());
        } else {
          const textContent = selection.getTextContent();
          const codeNode = $createCodeNode();
          selection.insertNodes([codeNode]);
          selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertRawText(textContent);
          }
        }
      });
    }
  }, [blockType]);

  const updateCodeblockLang = useCallback(
    (lang: string) => {
      if (!isInCodeblock) {
        return;
      }
      editorRef.current?.dispatchCommand(UPDATE_CODEBLOCK_LANG, { lang });
    },
    [editorRef.current, isInCodeblock],
  );

  const insertLink = useCallback(() => {
    if (!isLink) {
      setIsLink(true);
      editorRef.current
        ?.getLexicalEditor()
        ?.dispatchCommand(TOGGLE_LINK_COMMAND, sanitizeUrl('https://'));
    } else {
      setIsLink(false);
      editorRef.current?.getLexicalEditor()?.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  }, [editorRef.current, isLink]);

  useEffect(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const lexicalEditor = editor.getLexicalEditor();
    let cleanup: () => void = () => {};
    const handleLeixcalEditor = (editor: LexicalEditor) => {
      cleanup = mergeRegister(
        editor.registerUpdateListener(({ editorState }) => {
          editorState.read(() => {
            $updateToolbar();
          });
        }),
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          () => {
            $updateToolbar();
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          CAN_UNDO_COMMAND,
          (payload) => {
            setCanUndo(payload);
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          CAN_REDO_COMMAND,
          (payload) => {
            setCanRedo(payload);
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
      );
      return cleanup;
    };
    if (!lexicalEditor) {
      editor.on('initialized', handleLeixcalEditor);
      return () => {
        cleanup();
        editor.off('initialized', handleLeixcalEditor);
      };
    }
    return handleLeixcalEditor(lexicalEditor);
  }, [editorRef.current]);

  return {
    blockType,
    bold,
    bulletList,
    canRedo,
    canUndo,
    code,
    codeblockLang,
    formatCodeblock,
    insertLink,
    isBold,
    isCode,
    isEmpty,
    isInCodeblock,
    isItalic,
    isStrikethrough,
    isUnderline,
    italic,
    numberList,
    redo,
    strikethrough,
    underline,
    undo,
    updateCodeblockLang,
  };
}
