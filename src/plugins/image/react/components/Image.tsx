import { COMMAND_PRIORITY_LOW, SELECTION_CHANGE_COMMAND } from 'lexical';
import { memo, useMemo } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react/useLexicalEditor';
import { useLexicalNodeSelection } from '@/editor-kernel/react/useLexicalNodeSelection';

import { ImageNode } from '../../node/image-node';
import BrokenImage from './BrokenImage';
import LazyImage from './LazyImage';

const Image = memo<{ className?: string; node: ImageNode }>(({ node, className }) => {
  const [isSelected, setSelected] = useLexicalNodeSelection(node.getKey());
  // const [isNodeSelect] = useState(false);

  // useEffect(() => {
  //   if (isSelected) {
  //     console.log('Image selected:', node.getKey());
  //   } else {
  //     console.log('Image deselected:', node.getKey());
  //   }
  // }, [isSelected, node]);

  useLexicalEditor((editor) => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      (_, _activeEditor) => {
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, []);

  const children = useMemo(() => {
    switch (node.status) {
      case 'error': {
        return <BrokenImage />;
      }
      case 'uploaded':
      case 'loading': {
        return <LazyImage className={className} node={node} />;
      }
      default: {
        return null;
      }
    }
  }, [node.status, className, node]);

  return (
    <div
      draggable={false}
      onClick={() => setSelected(true)}
      style={{
        border: isSelected ? '1px solid blue' : '1px solid transparent',
        display: 'inline-block',
      }}
    >
      {children}
    </div>
  );
});

Image.displayName = 'Image';

export default Image;
