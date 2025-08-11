import { ReactNode, useEffect, useRef, useState } from 'react';

import { MenuRenderProps } from './ReactSlashPlugin';
import { useStyles } from './style';

const scrollIntoViewIfNeeded = (container: HTMLElement, target: HTMLElement) => {
  if (!container) {
    return;
  }

  const typeaheadRect = container.getBoundingClientRect();

  if (typeaheadRect.top + typeaheadRect.height > window.innerHeight) {
    container.scrollIntoView({
      block: 'center',
    });
  }

  if (typeaheadRect.top < 0) {
    container.scrollIntoView({
      block: 'center',
    });
  }

  target.scrollIntoView({ block: 'nearest' });
};

export const DefaultMenuRender = ({
  selectOptionAndCleanUp,
  setHighlightedIndex,
  options,
  loading,
  highlightedIndex,
}: MenuRenderProps) => {
  const ref = useRef<HTMLUListElement>(null);
  const [isFirst, setIsFirst] = useState(false);
  const { styles } = useStyles();

  useEffect(() => {
    if (isFirst) {
      setIsFirst(false);
      return;
    }
    if (ref.current) {
      const selected = ref.current.querySelector('.selected');
      if (selected) {
        scrollIntoViewIfNeeded(ref.current, selected as HTMLElement);
      }
    }
  }, [highlightedIndex]);

  return (
    <div className={styles.typeaheadPopover}>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <ul ref={ref}>
          {options.map((option, i: number) => (
            <li
              className={highlightedIndex === i ? 'selected' : ''}
              key={option.value}
              onClick={() => {
                setHighlightedIndex(i);
                selectOptionAndCleanUp(option);
              }}
              onMouseEnter={() => {
                setHighlightedIndex(i);
              }}
            >
              {option.label as ReactNode}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
