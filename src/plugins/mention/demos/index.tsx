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
              { icon: <Avatar avatar={'💻'} size={24} />, key: 'bot1', label: '前端研发专家' },
              { icon: <Avatar avatar={'🌍'} size={24} />, key: 'bot2', label: '中英文互译助手' },
              { icon: <Avatar avatar={'📖'} size={24} />, key: 'bot3', label: '学术写作增强专家' },
              { icon: <Avatar avatar={'🎨'} size={24} />, key: 'bot4', label: 'UI 设计顾问' },
              { icon: <Avatar avatar={'🔧'} size={24} />, key: 'bot5', label: '后端架构师' },
              { icon: <Avatar avatar={'📊'} size={24} />, key: 'bot6', label: '数据分析专家' },
              { icon: <Avatar avatar={'🤖'} size={24} />, key: 'bot7', label: 'AI 模型训练师' },
              { icon: <Avatar avatar={'📝'} size={24} />, key: 'bot8', label: '技术文档撰写' },
              { icon: <Avatar avatar={'🔒'} size={24} />, key: 'bot9', label: '安全审计专家' },
              { icon: <Avatar avatar={'☁️'} size={24} />, key: 'bot10', label: '云计算架构师' },
              { icon: <Avatar avatar={'📱'} size={24} />, key: 'bot11', label: '移动端开发专家' },
              { icon: <Avatar avatar={'🧪'} size={24} />, key: 'bot12', label: '测试工程师' },
              { icon: <Avatar avatar={'🚀'} size={24} />, key: 'bot13', label: 'DevOps 工程师' },
              { icon: <Avatar avatar={'🗄️'} size={24} />, key: 'bot14', label: '数据库管理员' },
              { icon: <Avatar avatar={'🌐'} size={24} />, key: 'bot15', label: '国际化翻译专家' },
              { icon: <Avatar avatar={'🎯'} size={24} />, key: 'bot16', label: '产品经理助手' },
              { icon: <Avatar avatar={'📈'} size={24} />, key: 'bot17', label: 'SEO 优化顾问' },
              { icon: <Avatar avatar={'🛠️'} size={24} />, key: 'bot18', label: '运维监控专家' },
              { icon: <Avatar avatar={'🎮'} size={24} />, key: 'bot19', label: '游戏开发顾问' },
              { icon: <Avatar avatar={'🧠'} size={24} />, key: 'bot20', label: '算法竞赛教练' },
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
