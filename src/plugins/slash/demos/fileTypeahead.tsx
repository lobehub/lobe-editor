import {
  INSERT_MENTION_COMMAND,
  ReactEditor,
  ReactEditorContent,
  ReactMentionPlugin,
  ReactPlainText,
  ReactSlashOption,
  ReactSlashPlugin,
} from '@lobehub/editor';

const FILE_OPTIONS = [
  'src/components/Editor.tsx',
  'src/components/SlashMenu.tsx',
  'src/plugins/slash/plugin/index.ts',
  'src/plugins/slash/react/ReactSlashPlugin.tsx',
  'src/plugins/slash/service/i-slash-service.ts',
  'src/plugins/slash/utils/utils.ts',
  'tests/plugins/slash/typeahead.test.ts',
].map((path) => ({ key: path, label: path }));

export default () => {
  return (
    <ReactEditor>
      <ReactPlainText>
        <ReactEditorContent
          content={''}
          placeholder={'Type @src/ to search files, or / to open commands'}
          type={'text'}
        />
      </ReactPlainText>
      <ReactMentionPlugin />
      <ReactSlashPlugin>
        <ReactSlashOption
          items={async (search) => {
            await new Promise((resolve) => setTimeout(resolve, 600));

            const query = search?.matchingString.toLowerCase() ?? '';
            return FILE_OPTIONS.filter((option) => option.key.toLowerCase().includes(query));
          }}
          onSelect={(editor, option) => {
            editor.dispatchCommand(INSERT_MENTION_COMMAND, {
              label: String(option.label),
              metadata: { path: option.key },
            });
          }}
          trigger={'@'}
        />
        <ReactSlashOption
          items={[
            { key: 'summarize', label: 'Summarize' },
            { key: 'translate', label: 'Translate' },
          ]}
          trigger={'/'}
        />
      </ReactSlashPlugin>
    </ReactEditor>
  );
};
