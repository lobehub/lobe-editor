import {
  ReactEditor,
  ReactEditorContent,
  ReactPlainText,
  ReactSlashOption,
  ReactSlashPlugin,
} from '@lobehub/editor';

export default () => {
  return (
    <ReactEditor>
      <ReactPlainText>
        <ReactEditorContent content={''} placeholder={'Press / to open slash menu'} type="text" />
      </ReactPlainText>
      <ReactSlashPlugin>
        <ReactSlashOption
          items={[
            { key: 'heading1', label: 'Heading 1' },
            { key: 'heading2', label: 'Heading 2' },
            { key: 'heading3', label: 'Heading 3' },
            { type: 'divider' },
            { key: 'paragraph', label: 'Paragraph' },
            { key: 'quote', label: 'Quote' },
            { key: 'callout', label: 'Callout' },
            { type: 'divider' },
            { key: 'bulletList', label: 'Bullet List' },
            { key: 'numberedList', label: 'Numbered List' },
            { key: 'todoList', label: 'Todo List' },
            { type: 'divider' },
            { key: 'codeBlock', label: 'Code Block' },
            { key: 'mathBlock', label: 'Math Block' },
            { key: 'table', label: 'Table' },
            { key: 'divider', label: 'Divider' },
            { key: 'image', label: 'Image' },
            { key: 'video', label: 'Video' },
            { key: 'file', label: 'File' },
            { type: 'divider' },
            { key: 'toggleList', label: 'Toggle List' },
            { key: 'columns', label: 'Columns' },
            { key: 'linkPreview', label: 'Link Preview' },
            { key: 'embed', label: 'Embed' },
            { key: 'drawio', label: 'Draw.io Diagram' },
            { key: 'mermaid', label: 'Mermaid Chart' },
            { key: 'excalidraw', label: 'Excalidraw' },
            { key: 'toc', label: 'Table of Contents' },
          ]}
          onSelect={(_, option) => {
            console.log(option);
          }}
          trigger={'/'}
        />
      </ReactSlashPlugin>
    </ReactEditor>
  );
};
