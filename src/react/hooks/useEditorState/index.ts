import { $createCodeNode, $isCodeNode } from '@lexical/code';
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
} from '@lexical/list';
import { $createQuoteNode, $isHeadingNode, $isQuoteNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { $getNearestNodeOfType, mergeRegister } from '@lexical/utils';
import { debounce } from 'es-toolkit';
import {
  $createNodeSelection,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $setSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  LexicalEditor,
  LexicalNode,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  TextFormatType,
  UNDO_COMMAND,
} from 'lexical';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { noop } from '@/editor-kernel';
import { INSERT_CODEINLINE_COMMAND } from '@/plugins/code';
import { $isSelectionInCodeInline } from '@/plugins/code/node/code';
import { UPDATE_CODEBLOCK_LANG } from '@/plugins/codeblock';
import {
  $createCodeMirrorNode,
  $isCodeMirrorNode,
  CodeMirrorNode,
} from '@/plugins/codemirror-block/node/CodeMirrorNode';
import { $isRootTextContentEmpty } from '@/plugins/common/utils';
import { INSERT_LINK_HIGHLIGHT_COMMAND } from '@/plugins/link-highlight/command';
import { $isLinkHighlightNode } from '@/plugins/link-highlight/node/link-highlight';
import { $isLinkNode, TOGGLE_LINK_COMMAND, formatUrl } from '@/plugins/link/node/LinkNode';
import { extractUrlFromText, sanitizeUrl, validateUrl } from '@/plugins/link/utils';
import { INSERT_CHECK_LIST_COMMAND } from '@/plugins/list';
import { $createMathBlockNode, $createMathInlineNode } from '@/plugins/math/node';
import { IEditor } from '@/types';

import { $findTopLevelElement, formatParagraph, getSelectedNode } from './utils';

/**
 * Editor state and toolbar methods return type
 */
export interface EditorState {
  /** Current block type (e.g., 'paragraph', 'h1', 'h2', 'bullet', 'number', 'code') */
  blockType: string | null;
  /** Format selection as blockquote */
  blockquote: () => void;
  /** Toggle bold formatting */
  bold: () => void;
  /** Toggle bullet list */
  bulletList: () => void;
  /** Whether redo operation is available */
  canRedo: boolean;
  /** Whether undo operation is available */
  canUndo: boolean;
  /** Toggle check list */
  checkList: () => void;
  /** Toggle code formatting */
  code: () => void;
  /** Format selection as code block */
  codeblock: () => void;
  /** Current code block language */
  codeblockLang: string | null | undefined;
  /** Insert or toggle link */
  insertLink: () => void;
  /** Insert math (inline or block based on context) */
  insertMath: () => void;
  /** Whether cursor is inside a blockquote */
  isBlockquote: boolean;
  /** Whether selection has bold formatting */
  isBold: boolean;
  /** Whether selection has code formatting */
  isCode: boolean;
  /** Whether cursor is inside a code block */
  isCodeblock: boolean;
  /** Whether editor content is empty */
  isEmpty: boolean;
  /** Whether selection has italic formatting */
  isItalic: boolean;
  /** Whether editor has selection */
  isSelected: boolean;
  /** Whether selection has strikethrough formatting */
  isStrikethrough: boolean;
  /** Whether selection has underline formatting */
  isUnderline: boolean;
  /** Toggle italic formatting */
  italic: () => void;
  /** Toggle numbered list */
  numberList: () => void;
  /** Redo last operation */
  redo: () => void;
  /** Toggle strikethrough formatting */
  strikethrough: () => void;
  /** Toggle underline formatting */
  underline: () => void;
  /** Undo last operation */
  undo: () => void;
  /** Update code block language */
  updateCodeblockLang: (lang: string) => void;
}

/**
 * Provide toolbar state and toolbar methods
 * @param editor - Editor instance
 * @returns Editor state and methods for toolbar functionality
 */
export function useEditorState(editor?: IEditor): EditorState {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [editable, setEditable] = useState(editor?.isEditable() ?? true);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isSubscript, setIsSubscript] = useState(false);
  const [isSuperscript, setIsSuperscript] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isLink, setIsLink] = useState(false);
  const [isCodeblock, setIsInCodeblok] = useState(false);
  const [isBlockquote, setIsInBlockquote] = useState(false);
  const [codeblockLang, setCodeblockLang] = useState<string | null | undefined>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [isSelected, setIsSelected] = useState(false);
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
    const lexicalEditor = editor?.getLexicalEditor();
    setIsSelected(false);
    setEditable(editor?.isEditable() ?? true);
    if (lexicalEditor) {
      setIsEmpty($isRootTextContentEmpty(lexicalEditor.isComposing(), false));
    }

    if ($isRangeSelection(selection)) {
      setIsSelected(!!selection._cachedNodes);
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
      setIsStrikethrough(selection.hasFormat('strikethrough'));
      setIsSubscript(selection.hasFormat('subscript'));
      setIsSuperscript(selection.hasFormat('superscript'));
      setIsCode($isSelectionInCodeInline(lexicalEditor!));

      const anchorNode = selection.anchor.getNode();
      const focusNode = selection.focus.getNode();
      const element = $findTopLevelElement(anchorNode);
      const focusElement = $findTopLevelElement(focusNode);
      const elementKey = element.getKey();
      const elementDOM = editor?.getLexicalEditor()?.getElementByKey(elementKey);

      const node = getSelectedNode(selection);

      const parent = node.getParent();
      // Check for both Link and LinkHighlight nodes
      setIsLink(
        $isLinkNode(parent) ||
          $isLinkNode(node) ||
          $isLinkHighlightNode(parent) ||
          $isLinkHighlightNode(node),
      );
      // Support both CodeNode (from codeblock plugin) and CodeMirrorNode (from codemirror-block plugin)
      const isLexicalCodeBlock =
        $isCodeNode(element) && $isCodeNode(focusElement) && elementKey === focusElement.getKey();
      const isCodeMirrorBlock =
        $isCodeMirrorNode(element) &&
        $isCodeMirrorNode(focusElement) &&
        elementKey === focusElement.getKey();
      const isCodeBlock = isLexicalCodeBlock || isCodeMirrorBlock;
      setIsInCodeblok(isCodeBlock);

      if (isLexicalCodeBlock) {
        setCodeblockLang(element.getLanguage());
      } else if (isCodeMirrorBlock) {
        setCodeblockLang((element as CodeMirrorNode).lang);
      } else {
        setCodeblockLang('');
      }

      const isBlockquote =
        $isQuoteNode(element) && $isQuoteNode(focusElement) && elementKey === focusElement.getKey();
      setIsInBlockquote(isBlockquote);

      if (elementDOM !== null) {
        if ($isListNode(element)) {
          const parentList = $getNearestNodeOfType<ListNode>(anchorNode, ListNode);
          const type = parentList ? parentList.getListType() : element.getListType();

          setBlockType(type);
        } else {
          $handleHeadingNode(element);
        }
      }
    } else if (!selection) {
      setIsSelected(false);
      setIsBold(false);
      setIsItalic(false);
      setIsUnderline(false);
      setIsStrikethrough(false);
      setIsSubscript(false);
      setIsSuperscript(false);
      setIsCode(false);
      setIsLink(false);
      setIsInCodeblok(false);
      setIsInBlockquote(false);
      setCodeblockLang(null);
      setBlockType(null);
    }
  }, [editor]);

  const undo = useCallback(() => {
    editor?.dispatchCommand(UNDO_COMMAND, undefined);
  }, [editor]);

  const redo = useCallback(() => {
    editor?.dispatchCommand(REDO_COMMAND, undefined);
  }, [editor]);

  const formatText = useCallback(
    (type: TextFormatType) => {
      editor?.dispatchCommand(FORMAT_TEXT_COMMAND, type);
    },
    [editor],
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

  const subscript = useCallback(() => {
    formatText('subscript');
  }, [formatText]);

  const superscript = useCallback(() => {
    formatText('superscript');
  }, [formatText]);

  const code = useCallback(() => {
    editor?.dispatchCommand(INSERT_CODEINLINE_COMMAND, undefined);
  }, [formatText]);

  const bulletList = useCallback(() => {
    if (blockType !== 'bullet') {
      editor?.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else {
      formatParagraph(editor?.getLexicalEditor());
    }
  }, [blockType, editor]);

  const numberList = useCallback(() => {
    if (blockType !== 'number') {
      editor?.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    } else {
      formatParagraph(editor?.getLexicalEditor());
    }
  }, [blockType, editor]);

  const checkList = useCallback(() => {
    if (blockType !== 'check') {
      editor?.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
    } else {
      formatParagraph(editor?.getLexicalEditor());
    }
  }, [blockType, editor]);

  const codeblock = useCallback(() => {
    if (blockType !== 'code') {
      editor?.getLexicalEditor()?.update(() => {
        let selection = $getSelection();
        if (!selection) {
          return;
        }

        // Try to use CodeMirrorNode if available, otherwise fall back to CodeNode
        const lexicalEditor = editor?.getLexicalEditor();
        const hasCodeMirrorNode = lexicalEditor
          ? lexicalEditor._nodes.has('code') &&
            lexicalEditor._nodes.get('code')?.klass.name === 'CodeMirrorNode'
          : false;

        if (hasCodeMirrorNode) {
          // Use CodeMirrorNode
          if (!$isRangeSelection(selection) || selection.isCollapsed()) {
            const textContent = selection.getTextContent();
            const codeMirrorNode = $createCodeMirrorNode('plain', textContent);
            const nodeSelection = $createNodeSelection();
            nodeSelection.add(codeMirrorNode.getKey());
            selection.insertNodes([codeMirrorNode]);
            $setSelection(nodeSelection);
          } else {
            const textContent = selection.getTextContent();
            const codeMirrorNode = $createCodeMirrorNode('plain', textContent);
            selection.insertNodes([codeMirrorNode]);
            const nodeSelection = $createNodeSelection();
            nodeSelection.add(codeMirrorNode.getKey());
            $setSelection(nodeSelection);
          }
        } else {
          // Use original CodeNode
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
        }
      });
    } else {
      formatParagraph(editor?.getLexicalEditor());
    }
  }, [blockType, editor]);

  const blockquote = useCallback(() => {
    if (blockType !== 'quote') {
      editor?.getLexicalEditor()?.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createQuoteNode());
        }
      });
    } else {
      formatParagraph(editor?.getLexicalEditor());
    }
  }, [blockType, editor]);

  const updateCodeblockLang = useCallback(
    (lang: string) => {
      if (!isCodeblock) {
        return;
      }
      editor?.dispatchCommand(UPDATE_CODEBLOCK_LANG, { lang });
    },
    [editor, isCodeblock],
  );

  const insertLink = useCallback(() => {
    const lexical = editor?.getLexicalEditor();
    if (!lexical) return;

    // Detect which link type we're currently in
    let inLinkNode = false;
    let inLinkHighlightNode = false;

    lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const node = getSelectedNode(selection);
        const parent = node.getParent();

        if ($isLinkNode(parent) || $isLinkNode(node)) {
          inLinkNode = true;
        }
        if ($isLinkHighlightNode(parent) || $isLinkHighlightNode(node)) {
          inLinkHighlightNode = true;
        }
      }
    });

    // If inside LinkHighlightNode, toggle it
    if (inLinkHighlightNode) {
      lexical.dispatchCommand(INSERT_LINK_HIGHLIGHT_COMMAND, undefined);
      setIsLink(false);
      return;
    }

    // If inside LinkNode, toggle it with standard Link plugin
    if (inLinkNode) {
      setIsLink(false);
      lexical.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      return;
    }

    // Not in any link - try to insert new link
    // Try LinkHighlight first, then fall back to standard Link if not handled
    if (!isLink) {
      // First try INSERT_LINK_HIGHLIGHT_COMMAND
      const linkHighlightHandled = lexical.dispatchCommand(
        INSERT_LINK_HIGHLIGHT_COMMAND,
        undefined,
      );

      if (linkHighlightHandled) {
        setIsLink(true);
        return;
      }

      // Fall back to standard Link plugin
      let nextUrl = sanitizeUrl('https://');
      let expandTo: { index: number; length: number } | null = null;
      lexical.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          const text = selection.getTextContent();
          if (!selection.isCollapsed()) {
            const maybeUrl = formatUrl(text.trim());
            if (validateUrl(maybeUrl)) {
              nextUrl = maybeUrl;
            }
          } else {
            const lineText = selection.anchor.getNode().getTextContent();
            const found = extractUrlFromText(lineText);
            if (found && validateUrl(formatUrl(found.url))) {
              expandTo = { index: found.index, length: found.length };
            }
          }
        }
      });
      setIsLink(true);

      lexical.update(() => {
        if (expandTo) {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            const anchorNode = selection.anchor.getNode();
            // Move selection to the URL range within the current text node
            selection.anchor.set(anchorNode.getKey(), expandTo.index, 'text');
            selection.focus.set(anchorNode.getKey(), expandTo.index + expandTo.length, 'text');
          }
        }

        lexical.dispatchCommand(
          TOGGLE_LINK_COMMAND,
          validateUrl(nextUrl) ? nextUrl : sanitizeUrl('https://'),
        );
      });
    }
  }, [editor, isLink]);

  const insertMath = useCallback(() => {
    editor?.getLexicalEditor()?.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        // 检查当前上下文来决定插入行内还是块级数学公式
        const anchorNode = selection.anchor.getNode();
        const element = $findTopLevelElement(anchorNode);

        // 判断是否应该插入块级数学公式的条件（默认插入 inline）：
        // 1. 在空段落开头（没有任何内容的段落）
        // 2. 选择了整行内容
        const shouldInsertBlock =
          ($isParagraphNode(element) &&
            selection.isCollapsed() &&
            selection.anchor.offset === 0 &&
            element.getTextContentSize() === 0) ||
          (!selection.isCollapsed() &&
            selection.anchor.offset === 0 &&
            selection.focus.offset === element.getTextContentSize());

        const mathNode = shouldInsertBlock ? $createMathBlockNode('') : $createMathInlineNode('');
        selection.insertNodes([mathNode]);

        // 选择新创建的数学节点
        const nodeSelection = $createNodeSelection();
        nodeSelection.add(mathNode.getKey());
        $setSelection(nodeSelection);
      }
    });
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const lexicalEditor = editor.getLexicalEditor();
    let cleanup: () => void = noop;
    const debounceUpdate = debounce(() => {
      lexicalEditor?.read(() => {
        $updateToolbar();
      });
    }, 500);
    const handleLexicalEditor = (lexicalEditor: LexicalEditor) => {
      cleanup = mergeRegister(
        lexicalEditor.registerUpdateListener(
          debounce(({ editorState }) => {
            editorState.read(() => {
              $updateToolbar();
            });
          }, 500),
        ),
        lexicalEditor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          () => {
            if (lexicalEditor.isComposing()) {
              return false;
            }
            debounceUpdate();
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
        lexicalEditor.registerCommand(
          CAN_UNDO_COMMAND,
          (payload) => {
            setCanUndo(payload);
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
        lexicalEditor.registerCommand(
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
      editor.on('initialized', handleLexicalEditor);
      return () => {
        cleanup();
        editor.off('initialized', handleLexicalEditor);
      };
    }
    return handleLexicalEditor(lexicalEditor);
  }, [editor, $updateToolbar]);

  return useMemo(
    () => ({
      blockType,
      blockquote,
      bold,
      bulletList,
      canRedo,
      canUndo,
      checkList,
      code,
      codeblock,
      codeblockLang,
      editable,
      insertLink,
      insertMath,
      isBlockquote,
      isBold,
      isCode,
      isCodeblock,
      isEmpty,
      isItalic,
      isSelected,
      isStrikethrough,
      isSubscript,
      isSuperscript,
      isUnderline,
      italic,
      numberList,
      redo,
      strikethrough,
      subscript,
      superscript,
      underline,
      undo,
      updateCodeblockLang,
    }),
    [
      blockType,
      canRedo,
      canUndo,
      codeblockLang,
      isBold,
      isCode,
      isEmpty,
      isBlockquote,
      isCodeblock,
      isItalic,
      isSelected,
      isStrikethrough,
      isUnderline,
      isSubscript,
      isSuperscript,
      italic,
    ],
  );
}
