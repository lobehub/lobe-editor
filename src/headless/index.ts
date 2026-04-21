import type { CommandPayloadType, SerializedEditorState, SerializedLexicalNode } from 'lexical';

import Editor, { moment } from '@/editor-kernel';
import { CodePlugin } from '@/plugins/code/plugin';
import { CommonPlugin } from '@/plugins/common/plugin';
import { HRPlugin } from '@/plugins/hr/plugin';
import { ListPlugin } from '@/plugins/list/plugin';
import {
  LITEXML_APPLY_COMMAND,
  LITEXML_INSERT_COMMAND,
  LITEXML_MODIFY_COMMAND,
  LITEXML_REMOVE_COMMAND,
} from '@/plugins/litexml/command';
import { LitexmlPlugin } from '@/plugins/litexml/plugin';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';
import { TablePlugin } from '@/plugins/table/plugin';
import type { IDocumentOptions, IEditor, IPlugin } from '@/types';

import { HeadlessCodeblockPlugin } from './plugins/codeblock';

export type HeadlessDocumentType = 'json' | 'litexml' | 'markdown' | (string & object);

export interface HeadlessEditorHydrationInput {
  content: unknown;
  options?: IDocumentOptions;
  type: HeadlessDocumentType;
}

export interface HeadlessEditorExportOptions {
  litexml?: boolean;
}

export interface HeadlessEditorExport {
  editorData: SerializedEditorState<SerializedLexicalNode>;
  litexml?: string;
  markdown: string;
}

export interface HeadlessEditorOptions {
  additionalPlugins?: ReadonlyArray<IPlugin>;
  initialValue?: HeadlessEditorHydrationInput;
  plugins?: ReadonlyArray<IPlugin>;
}

export interface HeadlessLiteXMLReplaceOperation {
  action: 'apply' | 'replace';
  delay?: boolean;
  litexml: string | string[];
}

export type HeadlessLiteXMLInsertOperation =
  | {
      action: 'insert';
      afterId: string;
      delay?: boolean;
      litexml: string;
    }
  | {
      action: 'insert';
      beforeId: string;
      delay?: boolean;
      litexml: string;
    };

export interface HeadlessLiteXMLRemoveOperation {
  action: 'remove';
  delay?: boolean;
  id: string;
}

export interface HeadlessLiteXMLBatchOperation {
  action: 'batch';
  operations: CommandPayloadType<typeof LITEXML_MODIFY_COMMAND>;
}

export type HeadlessLiteXMLOperation =
  | HeadlessLiteXMLBatchOperation
  | HeadlessLiteXMLInsertOperation
  | HeadlessLiteXMLRemoveOperation
  | HeadlessLiteXMLReplaceOperation;

type SerializedRecord = Record<string, unknown>;

interface NormalizeLegacyEditorDataContext {
  nextId: number;
}

const getNumericId = (id: unknown): number | null => {
  if (typeof id !== 'number' && typeof id !== 'string') return null;

  const numericId = Number(id);
  return Number.isInteger(numericId) && numericId >= 0 ? numericId : null;
};

const findMaxSerializedId = (node: unknown): number => {
  if (!node || typeof node !== 'object') return -1;

  const record = node as SerializedRecord;
  const id = getNumericId(record.id);
  const ownMax = id ?? -1;

  if (!Array.isArray(record.children)) return ownMax;

  return record.children.reduce(
    (maxId: number, child: unknown) => Math.max(maxId, findMaxSerializedId(child)),
    ownMax,
  );
};

const createSerializedId = (context: NormalizeLegacyEditorDataContext) => String(context.nextId++);

const createCodeChildrenFromLegacyCode = (
  code: string,
  context: NormalizeLegacyEditorDataContext,
) =>
  code.split('\n').flatMap((text, index, array) => {
    const textNode = {
      detail: 0,
      format: 0,
      id: createSerializedId(context),
      mode: 'normal',
      style: '',
      text,
      type: 'code-highlight',
      version: 1,
    };

    if (index === array.length - 1) {
      return textNode;
    }

    return [
      textNode,
      {
        id: createSerializedId(context),
        type: 'linebreak',
        version: 1,
      },
    ];
  });

const normalizeLegacyEditorDataNode = (
  node: unknown,
  context: NormalizeLegacyEditorDataContext,
): unknown => {
  if (!node || typeof node !== 'object') return node;

  const record = node as SerializedRecord;
  const children = Array.isArray(record.children)
    ? record.children.map((child: unknown) => normalizeLegacyEditorDataNode(child, context))
    : record.children;

  if (record.type === 'code' && typeof record.code === 'string' && !Array.isArray(children)) {
    return {
      ...record,
      children: createCodeChildrenFromLegacyCode(record.code, context),
      direction: record.direction ?? 'ltr',
      format: record.format ?? '',
      indent: record.indent ?? 0,
      language: record.language ?? 'plaintext',
      theme: record.theme ?? record.codeTheme,
    };
  }

  if (Array.isArray(children)) {
    return {
      ...record,
      children,
    };
  }

  return record;
};

const normalizeLegacyEditorData = (
  editorData: SerializedEditorState<SerializedLexicalNode> | string,
): SerializedEditorState<SerializedLexicalNode> | string => {
  const data =
    typeof editorData === 'string'
      ? (JSON.parse(editorData) as SerializedEditorState<SerializedLexicalNode>)
      : editorData;

  const context = {
    nextId: findMaxSerializedId(data.root) + 1,
  };

  return {
    ...data,
    root: normalizeLegacyEditorDataNode(data.root, context),
  } as SerializedEditorState<SerializedLexicalNode>;
};

export const DEFAULT_HEADLESS_EDITOR_PLUGINS: ReadonlyArray<IPlugin> = [
  [CommonPlugin, { enableHotkey: false }],
  MarkdownPlugin,
  CodePlugin,
  HeadlessCodeblockPlugin,
  HRPlugin,
  ListPlugin,
  TablePlugin,
  LitexmlPlugin,
];

export class HeadlessEditor {
  readonly kernel: IEditor;

  constructor(options: HeadlessEditorOptions = {}) {
    this.kernel = Editor.createEditor();

    const plugins = [
      ...(options.plugins ?? DEFAULT_HEADLESS_EDITOR_PLUGINS),
      ...(options.additionalPlugins ?? []),
    ];

    this.kernel.registerPlugins(plugins);
    this.kernel.initHeadlessEditor();

    if (options.initialValue) {
      this.hydrate(options.initialValue);
    }
  }

  hydrate(input: HeadlessEditorHydrationInput): this {
    this.kernel.setDocument(input.type, input.content, input.options);
    return this;
  }

  hydrateEditorData(
    editorData: SerializedEditorState<SerializedLexicalNode> | string,
    options?: IDocumentOptions,
  ): this {
    this.kernel.setDocument('json', normalizeLegacyEditorData(editorData), options);
    return this;
  }

  hydrateLiteXML(litexml: string, options?: IDocumentOptions): this {
    this.kernel.setDocument('litexml', litexml, options);
    return this;
  }

  hydrateMarkdown(markdown: string, options?: IDocumentOptions): this {
    this.kernel.setDocument('markdown', markdown, options);
    return this;
  }

  async applyLiteXML(
    operation: HeadlessLiteXMLOperation | ReadonlyArray<HeadlessLiteXMLOperation>,
  ): Promise<this> {
    const operations = Array.isArray(operation) ? operation : [operation];

    for (const item of operations) {
      this.applyLiteXMLOperation(item);
    }

    await moment();
    return this;
  }

  async applyLiteXMLBatch(
    operations: CommandPayloadType<typeof LITEXML_MODIFY_COMMAND>,
  ): Promise<this> {
    this.kernel.dispatchCommand(LITEXML_MODIFY_COMMAND, operations);
    await moment();
    return this;
  }

  export(options: HeadlessEditorExportOptions = {}): HeadlessEditorExport {
    const snapshot: HeadlessEditorExport = {
      editorData: this.kernel.getDocument(
        'json',
      ) as unknown as SerializedEditorState<SerializedLexicalNode>,
      markdown: this.kernel.getDocument('markdown') as unknown as string,
    };

    if (options.litexml) {
      snapshot.litexml = this.kernel.getDocument('litexml') as unknown as string;
    }

    return snapshot;
  }

  exportState(options?: HeadlessEditorExportOptions): HeadlessEditorExport {
    return this.export(options);
  }

  destroy(): void {
    this.kernel.destroy();
  }

  private applyLiteXMLOperation(operation: HeadlessLiteXMLOperation): void {
    switch (operation.action) {
      case 'apply':
      case 'replace': {
        this.kernel.dispatchCommand(LITEXML_APPLY_COMMAND, {
          delay: operation.delay,
          litexml: operation.litexml,
        });
        return;
      }

      case 'batch': {
        this.kernel.dispatchCommand(LITEXML_MODIFY_COMMAND, operation.operations);
        return;
      }

      case 'insert': {
        this.kernel.dispatchCommand(LITEXML_INSERT_COMMAND, operation);
        return;
      }

      case 'remove': {
        this.kernel.dispatchCommand(LITEXML_REMOVE_COMMAND, {
          delay: operation.delay,
          id: operation.id,
        });
        return;
      }
    }
  }
}

export function createHeadlessEditor(options?: HeadlessEditorOptions): HeadlessEditor {
  return new HeadlessEditor(options);
}
