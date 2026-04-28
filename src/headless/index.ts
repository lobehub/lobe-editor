import type { SerializedEditorState, SerializedLexicalNode } from 'lexical';

import Editor from '@/editor-kernel';
import { CodePlugin } from '@/plugins/code/plugin';
import { CommonPlugin } from '@/plugins/common/plugin';
import { HRPlugin } from '@/plugins/hr/plugin';
import { ListPlugin } from '@/plugins/list/plugin';
import { MarkdownPlugin } from '@/plugins/markdown/plugin';
import { TablePlugin } from '@/plugins/table/plugin';
import type { IDocumentOptions, IEditor, IPlugin } from '@/types';

import { HeadlessCodeblockPlugin } from './plugins/codeblock';

export type HeadlessDocumentType = 'json' | 'markdown' | (string & object);

export interface HeadlessEditorHydrationInput {
  content: unknown;
  options?: IDocumentOptions;
  type: HeadlessDocumentType;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface HeadlessEditorExportOptions {}

export interface HeadlessEditorExport {
  editorData: SerializedEditorState<SerializedLexicalNode>;
  markdown: string;
}

export interface HeadlessEditorOptions {
  additionalPlugins?: ReadonlyArray<IPlugin>;
  initialValue?: HeadlessEditorHydrationInput;
  plugins?: ReadonlyArray<IPlugin>;
}

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

  hydrateMarkdown(markdown: string, options?: IDocumentOptions): this {
    this.kernel.setDocument('markdown', markdown, options);
    return this;
  }

  export(_options?: HeadlessEditorExportOptions): HeadlessEditorExport {
    void _options;
    const snapshot: HeadlessEditorExport = {
      editorData: this.kernel.getDocument(
        'json',
      ) as unknown as SerializedEditorState<SerializedLexicalNode>,
      markdown: this.kernel.getDocument('markdown') as unknown as string,
    };

    return snapshot;
  }

  exportState(options?: HeadlessEditorExportOptions): HeadlessEditorExport {
    return this.export(options);
  }

  destroy(): void {
    this.kernel.destroy();
  }
}

export function createHeadlessEditor(options?: HeadlessEditorOptions): HeadlessEditor {
  return new HeadlessEditor(options);
}
