import { $createQuoteNode } from '@lexical/rich-text';
import { $createTableCellNode, $createTableNode, $createTableRowNode } from '@lexical/table';
import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getRoot,
  $setSelection,
  LexicalEditor,
  createEditor,
} from 'lexical';
import { describe, expect, it } from 'vitest';

import Editor from '@/editor-kernel';
import { CommonPlugin, MarkdownPlugin, TablePlugin } from '@/index';
import { IEditor } from '@/types';

import { $isCursorInQuote, $isCursorInTable } from '..';

async function update(editor: LexicalEditor, callback: () => void): Promise<void> {
  return new Promise((resolve) => {
    editor.update(() => {
      callback();
      resolve();
    });
  });
}

describe('Cursor Position Detection Utils', () => {
  let kernel: IEditor;

  beforeEach(() => {
    kernel = Editor.createEditor();
    kernel.registerPlugins([CommonPlugin, MarkdownPlugin, TablePlugin]);
    kernel.initNodeEditor();
  });

  describe('$isCursorInTable', () => {
    it('should return false when cursor is not in table', async () => {
      const editor = kernel.getLexicalEditor();

      if (!editor) {
        throw new Error('Editor not found');
      }

      await new Promise((resolve) => {
        editor.update(() => {
          const root = $getRoot();
          const paragraph = $createParagraphNode();
          const text = $createTextNode('Hello world');
          paragraph.append(text);
          root.append(paragraph);

          const selection = $createRangeSelection();
          selection.anchor.set(text.getKey(), 0, 'text');
          selection.focus.set(text.getKey(), 5, 'text');
          $setSelection(selection);

          const result = $isCursorInTable(selection);
          expect(result.inCell).toBe(false);
          expect(result.inTable).toBe(false);
          resolve(true);
        });
      });
    });

    it('should return true for inCell when cursor is in table cell', async () => {
      const editor = kernel.getLexicalEditor();

      if (!editor) {
        throw new Error('Editor not found');
      }

      await update(editor, () => {
        const root = $getRoot();

        // Create table structure
        const table = $createTableNode();
        const row = $createTableRowNode();
        const cell = $createTableCellNode(0);
        const paragraph = $createParagraphNode();
        const text = $createTextNode('Cell content');

        paragraph.append(text);
        cell.append(paragraph);
        row.append(cell);
        table.append(row);
        root.append(table);

        const selection = $createRangeSelection();
        selection.anchor.set(text.getKey(), 0, 'text');
        selection.focus.set(text.getKey(), 4, 'text');
        $setSelection(selection);

        const result = $isCursorInTable(selection);
        expect(result.inCell).toBe(true);
        expect(result.inTable).toBe(true);
      });
    });

    it('should return true for inTable but false for inCell when cursor is in table but not in cell', async () => {
      const editor = kernel.getLexicalEditor();

      if (!editor) {
        throw new Error('Editor not found');
      }

      await update(editor, () => {
        const root = $getRoot();

        // Create table structure with direct text in table (edge case)
        const table = $createTableNode();
        const text = $createTextNode('Direct table content');
        table.append(text);
        root.append(table);

        const selection = $createRangeSelection();
        selection.anchor.set(text.getKey(), 0, 'text');
        selection.focus.set(text.getKey(), 6, 'text');
        $setSelection(selection);

        const result = $isCursorInTable(selection);
        expect(result.inCell).toBe(false);
        expect(result.inTable).toBe(true);
      });
    });

    it('should handle null selection gracefully', async () => {
      const editor = kernel.getLexicalEditor();
      if (!editor) {
        throw new Error('Editor not found');
      }
      await update(editor, () => {
        const result = $isCursorInTable(null);
        expect(result.inCell).toBe(false);
        expect(result.inTable).toBe(false);
      });
    });

    it('should handle selection without focus gracefully', async () => {
      const editor = kernel.getLexicalEditor();
      if (!editor) {
        throw new Error('Editor not found');
      }
      await update(editor, () => {
        const result = $isCursorInTable({});
        expect(result.inCell).toBe(false);
        expect(result.inTable).toBe(false);
      });
    });

    it('should handle multiple table cells correctly', async () => {
      const editor = kernel.getLexicalEditor();

      if (!editor) {
        throw new Error('Editor not found');
      }

      await update(editor, () => {
        const root = $getRoot();

        // Create table with multiple cells
        const table = $createTableNode();
        const row = $createTableRowNode();
        const cell1 = $createTableCellNode(0);
        const cell2 = $createTableCellNode(0);
        const paragraph1 = $createParagraphNode();
        const paragraph2 = $createParagraphNode();
        const text1 = $createTextNode('Cell 1');
        const text2 = $createTextNode('Cell 2');

        paragraph1.append(text1);
        paragraph2.append(text2);
        cell1.append(paragraph1);
        cell2.append(paragraph2);
        row.append(cell1, cell2);
        table.append(row);
        root.append(table);

        // Test cursor in first cell
        const selection1 = $createRangeSelection();
        selection1.anchor.set(text1.getKey(), 0, 'text');
        selection1.focus.set(text1.getKey(), 4, 'text');
        $setSelection(selection1);

        const result1 = $isCursorInTable(selection1);
        expect(result1.inCell).toBe(true);
        expect(result1.inTable).toBe(true);

        // Test cursor in second cell
        const selection2 = $createRangeSelection();
        selection2.anchor.set(text2.getKey(), 0, 'text');
        selection2.focus.set(text2.getKey(), 4, 'text');
        $setSelection(selection2);

        const result2 = $isCursorInTable(selection2);
        expect(result2.inCell).toBe(true);
        expect(result2.inTable).toBe(true);
      });
    });

    it('should handle nested table structures', async () => {
      const editor = kernel.getLexicalEditor();

      if (!editor) {
        throw new Error('Editor not found');
      }

      await update(editor, () => {
        const root = $getRoot();

        // Create nested table (table inside table cell)
        const outerTable = $createTableNode();
        const outerRow = $createTableRowNode();
        const outerCell = $createTableCellNode(0);

        const innerTable = $createTableNode();
        const innerRow = $createTableRowNode();
        const innerCell = $createTableCellNode(0);
        const paragraph = $createParagraphNode();
        const text = $createTextNode('Nested table text');

        paragraph.append(text);
        innerCell.append(paragraph);
        innerRow.append(innerCell);
        innerTable.append(innerRow);
        outerCell.append(innerTable);
        outerRow.append(outerCell);
        outerTable.append(outerRow);
        root.append(outerTable);

        const selection = $createRangeSelection();
        selection.anchor.set(text.getKey(), 0, 'text');
        selection.focus.set(text.getKey(), 6, 'text');
        $setSelection(selection);

        const result = $isCursorInTable(selection);
        expect(result.inCell).toBe(true);
        expect(result.inTable).toBe(true);
      });
    });

    it('should handle table with multiple rows', async () => {
      const editor = kernel.getLexicalEditor();

      if (!editor) {
        throw new Error('Editor not found');
      }

      await update(editor, () => {
        const root = $getRoot();

        // Create table with multiple rows
        const table = $createTableNode();
        const row1 = $createTableRowNode();
        const row2 = $createTableRowNode();
        const cell1 = $createTableCellNode(0);
        const cell2 = $createTableCellNode(0);
        const paragraph1 = $createParagraphNode();
        const paragraph2 = $createParagraphNode();
        const text1 = $createTextNode('Row 1 Cell');
        const text2 = $createTextNode('Row 2 Cell');

        paragraph1.append(text1);
        paragraph2.append(text2);
        cell1.append(paragraph1);
        cell2.append(paragraph2);
        row1.append(cell1);
        row2.append(cell2);
        table.append(row1, row2);
        root.append(table);

        // Test cursor in first row
        const selection1 = $createRangeSelection();
        selection1.anchor.set(text1.getKey(), 0, 'text');
        selection1.focus.set(text1.getKey(), 3, 'text');
        $setSelection(selection1);

        const result1 = $isCursorInTable(selection1);
        expect(result1.inCell).toBe(true);
        expect(result1.inTable).toBe(true);

        // Test cursor in second row
        const selection2 = $createRangeSelection();
        selection2.anchor.set(text2.getKey(), 0, 'text');
        selection2.focus.set(text2.getKey(), 3, 'text');
        $setSelection(selection2);

        const result2 = $isCursorInTable(selection2);
        expect(result2.inCell).toBe(true);
        expect(result2.inTable).toBe(true);
      });
    });

    it('should handle empty table cell', async () => {
      const editor = kernel.getLexicalEditor();

      if (!editor) {
        throw new Error('Editor not found');
      }

      await update(editor, () => {
        const root = $getRoot();

        // Create table with empty cell
        const table = $createTableNode();
        const row = $createTableRowNode();
        const cell = $createTableCellNode(0);
        const paragraph = $createParagraphNode();

        cell.append(paragraph);
        row.append(cell);
        table.append(row);
        root.append(table);

        const selection = $createRangeSelection();
        selection.anchor.set(paragraph.getKey(), 0, 'element');
        selection.focus.set(paragraph.getKey(), 0, 'element');
        $setSelection(selection);

        const result = $isCursorInTable(selection);
        expect(result.inCell).toBe(true);
        expect(result.inTable).toBe(true);
      });
    });
  });

  describe('$isCursorInQuote', async () => {
    it('should return false when cursor is not in quote', async () => {
      const editor = kernel.getLexicalEditor();

      if (!editor) {
        throw new Error('Editor not found');
      }

      await update(editor, () => {
        const root = $getRoot();
        const paragraph = $createParagraphNode();
        const text = $createTextNode('Normal text');
        paragraph.append(text);
        root.append(paragraph);

        const selection = $createRangeSelection();
        selection.anchor.set(text.getKey(), 0, 'text');
        selection.focus.set(text.getKey(), 6, 'text');
        $setSelection(selection);

        const result = $isCursorInQuote(selection);
        expect(result).toBe(false);
      });
    });

    it('should return true when cursor is in quote block', async () => {
      const editor = kernel.getLexicalEditor();

      if (!editor) {
        throw new Error('Editor not found');
      }

      await update(editor, () => {
        const root = $getRoot();
        const quote = $createQuoteNode();
        const paragraph = $createParagraphNode();
        const text = $createTextNode('Quoted text');

        paragraph.append(text);
        quote.append(paragraph);
        root.append(quote);

        const selection = $createRangeSelection();
        selection.anchor.set(text.getKey(), 0, 'text');
        selection.focus.set(text.getKey(), 6, 'text');
        $setSelection(selection);

        const result = $isCursorInQuote(selection);
        expect(result).toBe(true);
      });
    });

    it('should handle nested quotes correctly', async () => {
      const editor = kernel.getLexicalEditor();

      if (!editor) {
        throw new Error('Editor not found');
      }

      await update(editor, () => {
        const root = $getRoot();
        const outerQuote = $createQuoteNode();
        const innerQuote = $createQuoteNode();
        const paragraph = $createParagraphNode();
        const text = $createTextNode('Nested quoted text');

        paragraph.append(text);
        innerQuote.append(paragraph);
        outerQuote.append(innerQuote);
        root.append(outerQuote);

        const selection = $createRangeSelection();
        selection.anchor.set(text.getKey(), 0, 'text');
        selection.focus.set(text.getKey(), 6, 'text');
        $setSelection(selection);

        const result = $isCursorInQuote(selection);
        expect(result).toBe(true);
      });
    });

    it('should return true for cursor in quote with multiple paragraphs', async () => {
      const editor = kernel.getLexicalEditor();

      if (!editor) {
        throw new Error('Editor not found');
      }

      await update(editor, () => {
        const root = $getRoot();
        const quote = $createQuoteNode();
        const paragraph1 = $createParagraphNode();
        const paragraph2 = $createParagraphNode();
        const text1 = $createTextNode('First quoted paragraph');
        const text2 = $createTextNode('Second quoted paragraph');

        paragraph1.append(text1);
        paragraph2.append(text2);
        quote.append(paragraph1, paragraph2);
        root.append(quote);

        // Test cursor in first paragraph
        const selection1 = $createRangeSelection();
        selection1.anchor.set(text1.getKey(), 0, 'text');
        selection1.focus.set(text1.getKey(), 5, 'text');
        $setSelection(selection1);

        const result1 = $isCursorInQuote(selection1);
        expect(result1).toBe(true);

        // Test cursor in second paragraph
        const selection2 = $createRangeSelection();
        selection2.anchor.set(text2.getKey(), 0, 'text');
        selection2.focus.set(text2.getKey(), 6, 'text');
        $setSelection(selection2);

        const result2 = $isCursorInQuote(selection2);
        expect(result2).toBe(true);
      });
    });

    it('should handle quote with mixed content types', async () => {
      const editor = kernel.getLexicalEditor();

      if (!editor) {
        throw new Error('Editor not found');
      }

      await update(editor, () => {
        const root = $getRoot();
        const quote = $createQuoteNode();
        const paragraph = $createParagraphNode();
        const text1 = $createTextNode('Quote with ');
        const text2 = $createTextNode('bold text');
        const text3 = $createTextNode(' and normal text');

        // Simulate formatted text by adding separate text nodes
        paragraph.append(text1, text2, text3);
        quote.append(paragraph);
        root.append(quote);

        // Test cursor in different text nodes within quote
        const selection1 = $createRangeSelection();
        selection1.anchor.set(text1.getKey(), 0, 'text');
        selection1.focus.set(text1.getKey(), 5, 'text');
        $setSelection(selection1);

        const result1 = $isCursorInQuote(selection1);
        expect(result1).toBe(true);

        const selection2 = $createRangeSelection();
        selection2.anchor.set(text2.getKey(), 0, 'text');
        selection2.focus.set(text2.getKey(), 4, 'text');
        $setSelection(selection2);

        const result2 = $isCursorInQuote(selection2);
        expect(result2).toBe(true);

        const selection3 = $createRangeSelection();
        selection3.anchor.set(text3.getKey(), 0, 'text');
        selection3.focus.set(text3.getKey(), 4, 'text');
        $setSelection(selection3);

        const result3 = $isCursorInQuote(selection3);
        expect(result3).toBe(true);
      });
    });

    it('should handle empty quote block', async () => {
      const editor = kernel.getLexicalEditor();

      if (!editor) {
        throw new Error('Editor not found');
      }

      await update(editor, () => {
        const root = $getRoot();
        const quote = $createQuoteNode();
        const paragraph = $createParagraphNode();

        quote.append(paragraph);
        root.append(quote);

        const selection = $createRangeSelection();
        selection.anchor.set(paragraph.getKey(), 0, 'element');
        selection.focus.set(paragraph.getKey(), 0, 'element');
        $setSelection(selection);

        const result = $isCursorInQuote(selection);
        expect(result).toBe(true);
      });
    });

    it('should handle quote followed by normal content', async () => {
      const editor = kernel.getLexicalEditor();

      if (!editor) {
        throw new Error('Editor not found');
      }

      await update(editor, () => {
        const root = $getRoot();

        // Create quote block
        const quote = $createQuoteNode();
        const quoteParagraph = $createParagraphNode();
        const quoteText = $createTextNode('Quoted text');
        quoteParagraph.append(quoteText);
        quote.append(quoteParagraph);

        // Create normal paragraph after quote
        const normalParagraph = $createParagraphNode();
        const normalText = $createTextNode('Normal text after quote');
        normalParagraph.append(normalText);

        root.append(quote, normalParagraph);

        // Test cursor in quote
        const selection1 = $createRangeSelection();
        selection1.anchor.set(quoteText.getKey(), 0, 'text');
        selection1.focus.set(quoteText.getKey(), 6, 'text');
        $setSelection(selection1);

        const result1 = $isCursorInQuote(selection1);
        expect(result1).toBe(true);

        // Test cursor in normal paragraph
        const selection2 = $createRangeSelection();
        selection2.anchor.set(normalText.getKey(), 0, 'text');
        selection2.focus.set(normalText.getKey(), 6, 'text');
        $setSelection(selection2);

        const result2 = $isCursorInQuote(selection2);
        expect(result2).toBe(false);
      });
    });

    it('should handle multiple quote blocks', async () => {
      const editor = kernel.getLexicalEditor();

      if (!editor) {
        throw new Error('Editor not found');
      }

      await update(editor, () => {
        const root = $getRoot();

        // Create first quote block
        const quote1 = $createQuoteNode();
        const paragraph1 = $createParagraphNode();
        const text1 = $createTextNode('First quote');
        paragraph1.append(text1);
        quote1.append(paragraph1);

        // Create normal paragraph between quotes
        const normalParagraph = $createParagraphNode();
        const normalText = $createTextNode('Normal text');
        normalParagraph.append(normalText);

        // Create second quote block
        const quote2 = $createQuoteNode();
        const paragraph2 = $createParagraphNode();
        const text2 = $createTextNode('Second quote');
        paragraph2.append(text2);
        quote2.append(paragraph2);

        root.append(quote1, normalParagraph, quote2);

        // Test cursor in first quote
        const selection1 = $createRangeSelection();
        selection1.anchor.set(text1.getKey(), 0, 'text');
        selection1.focus.set(text1.getKey(), 5, 'text');
        $setSelection(selection1);

        const result1 = $isCursorInQuote(selection1);
        expect(result1).toBe(true);

        // Test cursor in normal paragraph
        const selection2 = $createRangeSelection();
        selection2.anchor.set(normalText.getKey(), 0, 'text');
        selection2.focus.set(normalText.getKey(), 6, 'text');
        $setSelection(selection2);

        const result2 = $isCursorInQuote(selection2);
        expect(result2).toBe(false);

        // Test cursor in second quote
        const selection3 = $createRangeSelection();
        selection3.anchor.set(text2.getKey(), 0, 'text');
        selection3.focus.set(text2.getKey(), 6, 'text');
        $setSelection(selection3);

        const result3 = $isCursorInQuote(selection3);
        expect(result3).toBe(true);
      });
    });

    it('should handle null selection gracefully', async () => {
      const editor = kernel.getLexicalEditor();
      if (!editor) {
        throw new Error('Editor not found');
      }
      await update(editor, () => {
        const result = $isCursorInQuote(null);
        expect(result).toBe(false);
      });
    });

    it('should handle selection without focus gracefully', async () => {
      const editor = kernel.getLexicalEditor();
      if (!editor) {
        throw new Error('Editor not found');
      }
      await update(editor, () => {
        const result = $isCursorInQuote({});
        expect(result).toBe(false);
      });
    });

    it('should handle invalid selection object gracefully', async () => {
      const editor = kernel.getLexicalEditor();
      if (!editor) {
        throw new Error('Editor not found');
      }
      await update(editor, () => {
        const result = $isCursorInQuote({ focus: null });
        expect(result).toBe(false);
      });
    });

    it('should handle selection with invalid focus node', async () => {
      const editor = kernel.getLexicalEditor();
      if (!editor) {
        throw new Error('Editor not found');
      }
      await update(editor, () => {
        const result = $isCursorInQuote({
          focus: {
            getNode: () => null,
          },
        });
        expect(result).toBe(false);
      });
    });
  });

  describe('Complex scenarios', async () => {
    it('should handle table inside quote correctly', async () => {
      const editor = kernel.getLexicalEditor();

      if (!editor) {
        throw new Error('Editor not found');
      }

      await update(editor, () => {
        const root = $getRoot();
        const quote = $createQuoteNode();
        const table = $createTableNode();
        const row = $createTableRowNode();
        const cell = $createTableCellNode(0);
        const paragraph = $createParagraphNode();
        const text = $createTextNode('Table in quote');

        paragraph.append(text);
        cell.append(paragraph);
        row.append(cell);
        table.append(row);
        quote.append(table);
        root.append(quote);

        const selection = $createRangeSelection();
        selection.anchor.set(text.getKey(), 0, 'text');
        selection.focus.set(text.getKey(), 5, 'text');
        $setSelection(selection);

        const tableResult = $isCursorInTable(selection);
        const quoteResult = $isCursorInQuote(selection);

        expect(tableResult.inCell).toBe(true);
        expect(tableResult.inTable).toBe(true);
        expect(quoteResult).toBe(true);
      });
    });

    it('should handle quote inside table cell correctly', async () => {
      const editor = kernel.getLexicalEditor();

      if (!editor) {
        throw new Error('Editor not found');
      }

      await update(editor, () => {
        const root = $getRoot();
        const table = $createTableNode();
        const row = $createTableRowNode();
        const cell = $createTableCellNode(0);
        const quote = $createQuoteNode();
        const paragraph = $createParagraphNode();
        const text = $createTextNode('Quote in table');

        paragraph.append(text);
        quote.append(paragraph);
        cell.append(quote);
        row.append(cell);
        table.append(row);
        root.append(table);

        const selection = $createRangeSelection();
        selection.anchor.set(text.getKey(), 0, 'text');
        selection.focus.set(text.getKey(), 5, 'text');
        $setSelection(selection);

        const tableResult = $isCursorInTable(selection);
        const quoteResult = $isCursorInQuote(selection);

        expect(tableResult.inCell).toBe(true);
        expect(tableResult.inTable).toBe(true);
        expect(quoteResult).toBe(true);
      });
    });
  });
});
