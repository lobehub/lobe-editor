import type { SerializedEditorState } from 'lexical';

function makeText(text: string, extra: Record<string, unknown> = {}) {
  return {
    detail: 0,
    format: 0,
    mode: 'normal',
    style: '',
    text,
    type: 'text',
    version: 1,
    ...extra,
  };
}

function makeParagraph(text: string) {
  return {
    children: [makeText(text)],
    direction: 'ltr',
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
    type: 'paragraph',
    version: 1,
  };
}

function makeHeading(text: string, tag: 'h1' | 'h2' | 'h3' = 'h1') {
  return {
    children: [makeText(text)],
    direction: 'ltr',
    format: '',
    indent: 0,
    tag,
    type: 'heading',
    version: 1,
  };
}

function makeList(
  items: string[],
  listType: 'bullet' | 'number' = 'bullet',
  checked?: (boolean | undefined)[],
) {
  return {
    children: items.map((item, index) => ({
      checked: checked?.[index],
      children: [makeParagraph(item)],
      direction: null,
      format: '',
      indent: 0,
      type: 'listitem',
      value: index + 1,
      version: 1,
    })),
    direction: 'ltr',
    format: '',
    indent: 0,
    listType,
    start: 1,
    tag: listType === 'number' ? 'ol' : 'ul',
    type: 'list',
    version: 1,
  };
}

function makeQuote(text: string) {
  return {
    children: [
      {
        children: [makeText(text)],
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'quote',
    version: 1,
  };
}

function makeCode(code: string, language = 'typescript') {
  return {
    code,
    codeTheme: 'default',
    language,
    options: {
      indentWithTabs: false,
      lineNumbers: false,
      tabSize: 2,
    },
    type: 'code',
    version: 1,
  };
}

function makeEditorState(children: unknown[]): SerializedEditorState {
  return {
    root: {
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  } as unknown as SerializedEditorState;
}

export { makeCode, makeEditorState, makeHeading, makeList, makeParagraph, makeQuote, makeText };
