const text = (value: string, format = 0) => ({
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  text: value,
  type: 'text',
  version: 1,
});

const paragraph = (value = '') => ({
  children: value ? [text(value)] : [],
  direction: null,
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  type: 'paragraph',
  version: 1,
});

const heading = (value: string, tag: 'h1' | 'h2' | 'h3' = 'h1') => ({
  children: [text(value, tag === 'h1' ? 1 : 0)],
  direction: null,
  format: '',
  indent: 0,
  tag,
  type: 'heading',
  version: 1,
});

const listItem = (value: string, index: number) => ({
  children: [text(value)],
  direction: 'ltr',
  format: '',
  indent: 0,
  type: 'listitem',
  value: index,
  version: 1,
});

const bulletList = (items: string[]) => ({
  children: items.map((item, index) => listItem(item, index + 1)),
  direction: 'ltr',
  format: '',
  indent: 0,
  listType: 'bullet',
  start: 1,
  tag: 'ul',
  type: 'list',
  version: 1,
});

const tableCell = (value: string, headerState = 0) => ({
  backgroundColor: null,
  children: [paragraph(value)],
  colSpan: 1,
  direction: 'ltr',
  format: '',
  headerState,
  indent: 0,
  rowSpan: 1,
  type: 'tablecell',
  version: 1,
});

const tableRow = (cells: Array<{ header?: boolean; value: string }>) => ({
  children: cells.map((cell) => tableCell(cell.value, cell.header ? 3 : 0)),
  direction: 'ltr',
  format: '',
  height: null,
  indent: 0,
  type: 'tablerow',
  version: 1,
});

const table = () => ({
  children: [
    tableRow([
      { header: true, value: 'Area' },
      { header: true, value: 'Owner' },
      { header: true, value: 'Status' },
    ]),
    tableRow([{ value: 'Editor binding' }, { value: 'Alice' }, { value: 'Ready' }]),
    tableRow([{ value: 'Persistence relay' }, { value: 'Bo' }, { value: 'Validating' }]),
  ],
  colWidths: [180, 160, 180],
  direction: 'ltr',
  format: '',
  indent: 0,
  type: 'table',
  version: 1,
});

const blockImage = () => ({
  altText: 'Generated product board placeholder',
  height: 160,
  maxWidth: 640,
  src: 'https://dummyimage.com/960x320/e2e8f0/334155&text=Workspace+Artifact',
  status: 'uploaded',
  type: 'block-image',
  version: 1,
  width: 480,
});

const codeBlock = () => ({
  children: [],
  code: 'const roomId = `${workspaceId}:${pageId}`;\nconst provider = providerFactory(roomId, yjsDocMap);',
  codeTheme: 'default',
  direction: null,
  format: '',
  indent: 0,
  language: 'typescript',
  options: {
    indentWithTabs: false,
    lineNumbers: false,
    tabSize: 2,
  },
  type: 'code',
  version: 1,
});

const document = (children: unknown[]) => ({
  root: {
    children,
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
});

export const emptyPageContent = document([paragraph()]);

export const pageContents = {
  'launch-notes': document([
    heading('Q3 Launch Notes'),
    paragraph(
      'This local demo mirrors the intended business integration: workspace page metadata creates a room, the business shell creates a provider, and the editor owns the Lexical/Yjs binding.',
    ),
    bulletList([
      'Bootstrap only when the collaboration room is empty.',
      'Joining clients hydrate from the room snapshot.',
      'Presence and cursor state travel through awareness.',
    ]),
    table(),
    blockImage(),
    codeBlock(),
    paragraph(
      'Open all panes, focus either editable client, and edit from both sides to validate document sync and remote cursor presence.',
    ),
  ]),
  'retrospective': document([
    heading('Release Retrospective'),
    paragraph('This page validates room switching and a different persisted Y.Doc snapshot.'),
    bulletList(['What changed', 'What broke', 'What needs follow-up']),
    table(),
    paragraph('Switch back to launch notes to confirm old room cleanup and new room hydrate.'),
  ]),
  'roadmap': document([
    heading('Workspace Roadmap'),
    paragraph(
      'This page validates that each workspace page has an independent collaboration room.',
    ),
    bulletList(['Foundation', 'Presence', 'Persistence', 'Production hardening']),
    codeBlock(),
    paragraph(
      'Use remount controls to simulate re-entering the same page without overwriting Y.Doc.',
    ),
  ]),
} as const;

export const getInitialPageContent = (pageId: string) =>
  pageContents[pageId as keyof typeof pageContents] ?? pageContents['launch-notes'];
