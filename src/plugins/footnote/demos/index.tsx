import { INSERT_FOOTNOTE_COMMAND, ReactFootnotePlugin } from '@lobehub/editor';
import { Editor, useEditor } from '@lobehub/editor/react';
import { SuperscriptIcon } from 'lucide-react';

const content = `Lexical keeps the document as a tree of nodes[^tree]. Footnotes are numbered by the order of their first reference[^order], so moving text renumbers them[^tree].

[^order]: Identifiers are stable keys; the displayed number is derived.

[^tree]: Hover a reference to preview it, click to jump here, and use the back link to return.
`;

export default () => {
  const editor = useEditor();

  return (
    <Editor
      content={content}
      editor={editor}
      placeholder="Type / to insert a footnote"
      plugins={[ReactFootnotePlugin]}
      slashOption={{
        items: [
          {
            icon: SuperscriptIcon,
            key: 'footnote',
            label: 'Footnote',
            onSelect: (editor) => {
              editor.dispatchCommand(INSERT_FOOTNOTE_COMMAND, undefined);
            },
          },
        ],
      }}
      type="markdown"
    />
  );
};
