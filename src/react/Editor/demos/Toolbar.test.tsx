import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Toolbar from './Toolbar';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

vi.mock('@lobehub/editor', () => ({
  HotkeyEnum: {
    Bold: 'bold',
    BulletList: 'bulletList',
    CodeInline: 'codeInline',
    Italic: 'italic',
    Link: 'link',
    NumberList: 'numberList',
    Redo: 'redo',
    Strikethrough: 'strikethrough',
    Underline: 'underline',
    Undo: 'undo',
  },
  INSERT_FILE_COMMAND: Symbol('INSERT_FILE_COMMAND'),
  INSERT_IMAGE_COMMAND: Symbol('INSERT_IMAGE_COMMAND'),
  getHotkeyById: () => ({ keys: '' }),
}));

vi.mock('@lobehub/editor/react', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const renderItems = (items: any[]) => (
    <div data-testid="action-list">
      {items.map((item, index) =>
        item?.children ? (
          <span key={item.key || index}>{item.children}</span>
        ) : (
          <button key={item.key || index} type="button">
            {item?.label || item?.type}
          </button>
        ),
      )}
    </div>
  );
  return {
    ChatInputActions: ({ items = [] }: { items?: any[] }) => renderItems(items),
    CodeLanguageSelect: () => null,
    FloatActions: ({ items = [] }: { items?: any[] }) => renderItems(items),
    useEditorState: () => ({
      blockquote: vi.fn(),
      bold: vi.fn(),
      bulletList: vi.fn(),
      canRedo: false,
      canUndo: false,
      checkList: vi.fn(),
      code: vi.fn(),
      codeblock: vi.fn(),
      codeblockLang: 'plain',
      insertLink: vi.fn(),
      insertMath: vi.fn(),
      isBlockquote: false,
      isBold: false,
      isCode: false,
      isCodeblock: false,
      isItalic: false,
      isStrikethrough: false,
      isUnderline: false,
      numberList: vi.fn(),
      redo: vi.fn(),
      strikethrough: vi.fn(),
      underline: vi.fn(),
      undo: vi.fn(),
      updateCodeblockLang: vi.fn(),
    }),
  };
});

vi.mock('@lobehub/ui', () => ({
  Block: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: (factory: (tokens: any) => Record<string, string>) =>
    factory({
      css: () => '',
      cssVar: new Proxy({}, { get: () => '' }),
    }),
  cx: (...values: Array<string | undefined>) => values.filter(Boolean).join(' '),
}));

vi.mock('lucide-react', () => {
  const icon = () => null;
  return {
    BoldIcon: icon,
    CodeXmlIcon: icon,
    FileUpIcon: icon,
    ImageIcon: icon,
    ItalicIcon: icon,
    LinkIcon: icon,
    ListIcon: icon,
    ListOrderedIcon: icon,
    ListTodoIcon: icon,
    MessageSquareQuote: icon,
    Redo2Icon: icon,
    SigmaIcon: icon,
    SquareDashedBottomCodeIcon: icon,
    StrikethroughIcon: icon,
    UnderlineIcon: icon,
    Undo2Icon: icon,
  };
});

vi.mock('./actions', () => ({ openFileSelector: vi.fn() }));

describe('Editor demo Toolbar', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('accepts an existing toolbar child action in the floating toolbar', async () => {
    const editor = {
      dispatchCommand: vi.fn(),
    };

    await act(async () => {
      root.render(
        <Toolbar
          annotationAction={<button data-testid="comment-action">评论</button>}
          editor={editor as any}
          floating
        />,
      );
    });

    expect(host.querySelector('[data-testid="comment-action"]')?.textContent).toBe('评论');
  });
});
