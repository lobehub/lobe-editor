import { ReactNode } from 'react';

import { MenuRenderProps } from './ReactSlashPlugin';
import { useStyles } from './style';

export const DefaultMenuRender = ({
  selectOptionAndCleanUp,
  setHighlightedIndex,
  options,
  highlightedIndex,
}: MenuRenderProps) => {
  const { styles } = useStyles();

  return (
    <div className={styles.typeaheadPopover}>
      <ul>
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
    </div>
  );
};
