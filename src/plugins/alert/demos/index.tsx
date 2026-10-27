import { INSERT_ALERT_COMMAND, ReactAlertPlugin, ReactListPlugin } from '@lobehub/editor';
import { Editor, useEditor } from '@lobehub/editor/react';
import { InfoIcon, TriangleAlertIcon } from 'lucide-react';

const content = `> [!NOTE]
> Alerts hold regular blocks: paragraphs, **formatted text** and lists.
>
> - First item
> - Second item

> [!TIP]
> Click the alert label to change its type.

> [!WARNING]
> A plain blockquote without a marker stays a quote.

> Just a quote.
`;

export default () => {
  const editor = useEditor();

  return (
    <Editor
      content={content}
      editor={editor}
      placeholder="Type / to insert an alert"
      plugins={[ReactListPlugin, ReactAlertPlugin]}
      slashOption={{
        items: [
          {
            icon: InfoIcon,
            key: 'callout',
            label: 'Alert',
            onSelect: (editor) => {
              editor.dispatchCommand(INSERT_ALERT_COMMAND, { alertType: 'note' });
            },
          },
          {
            icon: TriangleAlertIcon,
            key: 'warning',
            label: 'Warning alert',
            onSelect: (editor) => {
              editor.dispatchCommand(INSERT_ALERT_COMMAND, { alertType: 'warning' });
            },
          },
        ],
        searchKeys: ['key', 'label'],
      }}
      type="markdown"
    />
  );
};
