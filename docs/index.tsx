import { Block } from '@lobehub/ui';
import { Features, FeaturesProps } from '@lobehub/ui/awesome';
import { Puzzle, Slash, Zap } from 'lucide-react';
import { Center } from 'react-layout-kit';

import Editor from '@/react/Editor/demos/index';

const items: FeaturesProps['items'] = [
  {
    description:
      "Built on Meta's robust Lexical framework for reliable rich text editing with powerful features.",
    icon: Zap,
    title: 'Lexical-Powered',
  },

  {
    description:
      'Extensible architecture with modular plugins for images, code blocks, links, lists, and more.',
    icon: Puzzle,
    title: 'Plugin System',
  },
  {
    description:
      'Quick content insertion with customizable slash menu for enhanced editing experience.',
    icon: Slash,
    title: 'Slash Commands',
  },
];

export default () => {
  return (
    <Center
      gap={48}
      style={{ maxWidth: 960, overflow: 'hidden', position: 'relative', width: '100%' }}
    >
      <Block variant={'outlined'} width={'100%'}>
        <Editor />
      </Block>
      <Features items={items} />
    </Center>
  );
};
