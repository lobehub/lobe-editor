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
            {
              key: 'item1',
              label: 'Item1',
            },
            {
              key: 'item2',
              label: 'Item2',
            },
            {
              type: 'divider',
            },
            {
              key: 'item3',
              label: 'Item3',
            },
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
