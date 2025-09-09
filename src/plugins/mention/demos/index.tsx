import {
  INSERT_MENTION_COMMAND,
  ReactEditor,
  ReactEditorContent,
  ReactMentionPlugin,
  ReactPlainText,
  ReactSlashOption,
  ReactSlashPlugin,
} from '@lobehub/editor';
import { Avatar } from '@lobehub/ui';

import content from './data.json';

export default () => {
  return (
    <ReactEditor>
      <ReactPlainText>
        <ReactEditorContent content={content} type="json" />
      </ReactPlainText>
      <ReactMentionPlugin
        markdownWriter={(mention) => {
          return `\n<mention>${mention.label}[${mention.metadata.id}]</mention>\n`;
        }}
      />
      <ReactSlashPlugin>
        <ReactSlashOption
          items={async (search) => {
            console.log(search);
            const data = [
              {
                icon: <Avatar avatar={'💻'} size={24} />,
                key: 'bot1',
                label: '前端研发专家',
              },
              {
                icon: <Avatar avatar={'🌍'} size={24} />,
                key: 'bot2',
                label: '中英文互译助手',
              },
              {
                icon: <Avatar avatar={'📖'} size={24} />,
                key: 'bot3',
                label: '学术写作增强专家',
              },
            ];
            if (!search?.matchingString) return data;
            return data.filter((item) => {
              if (!item.label) return true;
              return item.label.toLowerCase().includes(search.matchingString.toLowerCase());
            });
          }}
          maxLength={6}
          onSelect={(editor, option) => {
            editor.dispatchCommand(INSERT_MENTION_COMMAND, {
              label: String(option.label),
            });
          }}
          trigger={'@'}
        />
      </ReactSlashPlugin>
    </ReactEditor>
  );
};
