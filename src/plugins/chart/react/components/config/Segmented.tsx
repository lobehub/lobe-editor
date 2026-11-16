import type { ReactNode } from 'react';

import { styles } from './style';

export interface SegmentedOption<T extends string> {
  label: ReactNode;
  name: string;
  value: T;
}

interface SegmentedProps<T extends string> {
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  value: T;
}

const Segmented = <T extends string>({ onChange, options, value }: SegmentedProps<T>) => (
  <div className={styles.segmented} role="group">
    {options.map((option) => (
      <button
        aria-label={option.name}
        aria-pressed={option.value === value}
        className={styles.segment}
        key={option.value}
        onClick={() => onChange(option.value)}
        type="button"
      >
        {option.label}
      </button>
    ))}
  </div>
);

export default Segmented;
