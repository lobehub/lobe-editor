/* eslint-disable no-redeclare */
/* eslint-disable @typescript-eslint/no-redeclare */
import { BaseSelection, ElementNode, LexicalEditor, LexicalNode, TextNode } from 'lexical';

import { genServiceId } from '@/editor-kernel';
import { IRootNode } from '@/editor-kernel/inode';
import type { IEditorKernel, IServiceID } from '@/types/kernel';
import { createDebugLogger } from '@/utils/debug';

import {
  type MarkdownReaderFunc,
  type TransformerRecord,
  type TransfromerRecordArray,
  parseMarkdownToLexical,
} from '../data-source/markdown/parse';
import { indexBy, insertIRootNode } from '../utils';
import type {
  ElementTransformer,
  TextFormatTransformer,
  TextMatchTransformer,
  Transformer,
} from './transformers';
import {
  $runTextFormatTransformers,
  runElementTransformers,
  runTextMatchTransformers,
  testElementTransformers,
} from './transformers';

export interface IMarkdownWriterContext {
  /**
   * Add processor
   * @param processor
   */
  addProcessor(processor: (before: string, content: string, after: string) => string): void;

  // Define the context properties needed for the markdown writer
  /**
   * Direct output
   * @param line
   * @returns
   */
  appendLine: (line: string) => void;

  /**
   * Control child node to markdown
   * @param parentCtx
   * @param child
   * @returns
   */
  processChild: (parentCtx: IMarkdownWriterContext, child: LexicalNode) => void;

  /**
   * Wrap child elements
   * @param before
   * @param after
   * @returns
   */
  wrap: (before: string, after: string) => void;
}

export const MARKDOWN_WRITER_LEVEL_MAX = 0;
export const MARKDOWN_READER_LEVEL_HIGH = 1;
export const MARKDOWN_READER_LEVEL_NORMAL = 2;

export type MARKDOWN_READER_LEVEL =
  | typeof MARKDOWN_READER_LEVEL_HIGH
  | typeof MARKDOWN_READER_LEVEL_NORMAL
  | typeof MARKDOWN_WRITER_LEVEL_MAX;

export interface IMarkdownShortCutService {
  insertIRootNode(editor: LexicalEditor, root: IRootNode, selection: BaseSelection): void;

  parseMarkdownToLexical(markdown: string): IRootNode;

  /**
   * Register Markdown reader
   */
  registerMarkdownReader<K extends keyof TransformerRecord>(
    type: K,
    reader: MarkdownReaderFunc<K>,
    level?: MARKDOWN_READER_LEVEL,
  ): void;
  registerMarkdownShortCut(transformer: Transformer): void;
  registerMarkdownShortCuts(transformers: Transformer[]): void;

  /**
   * Register Markdown writer
   * @param type Lexical Node type
   * @param writer
   */
  registerMarkdownWriter(
    type: string,
    writer: (ctx: IMarkdownWriterContext, node: LexicalNode) => void | boolean,
  ): void;
}

export const IMarkdownShortCutService: IServiceID<IMarkdownShortCutService> =
  genServiceId<IMarkdownShortCutService>('MarkdownShortCutService');

export class MarkdownShortCutService implements IMarkdownShortCutService {
  private elementTransformers: Array<ElementTransformer> = [];
  private textFormatTransformers: Array<TextFormatTransformer> = [];
  private textMatchTransformers: Array<TextMatchTransformer> = [];
  private logger = createDebugLogger('service', 'markdown');

  private _markdownWriters: Record<
    string,
    (_ctx: IMarkdownWriterContext, _node: LexicalNode) => boolean | void
  > = {};

  private _markdownReaders: [
    TransfromerRecordArray,
    TransfromerRecordArray,
    TransfromerRecordArray,
  ] = [{}, {}, {}];

  constructor(private kernel?: IEditorKernel) {}

  get markdownWriters() {
    return this._markdownWriters;
  }

  get markdownReaders() {
    return this._markdownReaders.reduce(
      (acc: TransfromerRecordArray, curr: TransfromerRecordArray) => {
        // @ts-expect-error not error
        Object.keys(curr).forEach((key: keyof TransfromerRecordArray) => {
          if (!acc[key]) {
            acc[key] = [];
          }
          const existing = acc[key] as Array<MarkdownReaderFunc<typeof key>>;
          const adding = curr[key];
          existing.push(...(adding as Array<MarkdownReaderFunc<typeof key>>));
        });
        return acc;
      },
      {} as TransfromerRecordArray,
    );
  }

  private _textFormatTransformersByTrigger: Readonly<
    Record<string, ReadonlyArray<TextFormatTransformer>>
  > | null = null;
  private _textMatchTransformersByTrigger: Readonly<
    Record<string, Array<TextMatchTransformer>>
  > | null = null;

  get textMatchTransformersByTrigger() {
    if (!this._textMatchTransformersByTrigger) {
      this._textMatchTransformersByTrigger = indexBy(
        this.textMatchTransformers,
        ({ trigger }) => trigger,
      );
    }
    return this._textMatchTransformersByTrigger;
  }

  get textFormatTransformersByTrigger() {
    if (!this._textFormatTransformersByTrigger) {
      this._textFormatTransformersByTrigger = indexBy(this.textFormatTransformers, ({ tag }) =>
        tag.at(-1),
      );
    }
    return this._textFormatTransformersByTrigger;
  }

  registerMarkdownShortCut(transformer: Transformer): void {
    switch (transformer.type) {
      case 'element': {
        this.elementTransformers.push(transformer);

        break;
      }
      case 'text-format': {
        this.textFormatTransformers.push(transformer);

        break;
      }
      case 'text-match': {
        this.textMatchTransformers.push(transformer);

        break;
      }
      default: {
        throw new Error(`Unknown transformer type: ${transformer}`);
      }
    }
  }

  registerMarkdownShortCuts(transformers: Transformer[]): void {
    for (const transformer of transformers) {
      this.registerMarkdownShortCut(transformer);
    }
  }

  testTransformers(
    parentNode: ElementNode,
    anchorNode: TextNode,
    anchorOffset: number,
    trigger?: 'enter',
  ): boolean {
    if (
      testElementTransformers(
        parentNode,
        anchorNode,
        anchorOffset,
        this.elementTransformers,
        trigger,
      )
    ) {
      return true;
    }

    return false;
  }

  runTransformers(
    parentNode: ElementNode,
    anchorNode: TextNode,
    anchorOffset: number,
    trigger?: 'enter',
  ): boolean {
    if (
      runElementTransformers(
        parentNode,
        anchorNode,
        anchorOffset,
        this.elementTransformers,
        trigger,
      )
    ) {
      return true;
    }

    if (runTextMatchTransformers(anchorNode, anchorOffset, this.textMatchTransformersByTrigger)) {
      return true;
    }

    if (
      $runTextFormatTransformers(anchorNode, anchorOffset, this.textFormatTransformersByTrigger)
    ) {
      return true;
    }

    return false;
  }

  registerMarkdownWriter(
    type: string,
    writer: (ctx: IMarkdownWriterContext, node: LexicalNode) => boolean | void,
  ): void {
    if (!this._markdownWriters[type]) {
      this._markdownWriters[type] = writer;
      return;
    }
    if (this.kernel?.isHotReloadMode()) {
      this.logger.warn(`🔄 Hot reload: markdown writer "${type}"`);
      this._markdownWriters[type] = writer;
      return;
    }
    throw new Error(`Markdown writer for type "${type}" is already registered.`);
  }

  registerMarkdownReader<K extends keyof TransformerRecord>(
    type: K,
    reader: MarkdownReaderFunc<K>,
    level: MARKDOWN_READER_LEVEL = MARKDOWN_READER_LEVEL_NORMAL,
  ): void {
    if (!this._markdownReaders[level][type]) {
      this._markdownReaders[level][type] = [];
    }

    if (this._markdownReaders[level]) {
      this._markdownReaders[level][type]?.push(reader);
    }
  }

  parseMarkdownToLexical(markdown: string): IRootNode {
    return parseMarkdownToLexical(markdown, this.markdownReaders);
  }

  insertIRootNode(editor: LexicalEditor, root: IRootNode, selection: BaseSelection): void {
    insertIRootNode(editor, root, selection);
  }
}
