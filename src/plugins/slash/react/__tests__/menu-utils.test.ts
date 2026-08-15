import { describe, expect, it } from 'vitest';

import type { ISlashOption } from '../../service/i-slash-service';
import {
  findSlashOptionByKey,
  getNextSlashActiveKey,
  getNextSlashSpatialActiveKey,
} from '../menu-utils';

describe('slash menu utils', () => {
  const options: ISlashOption[] = [
    { key: 'paragraph', label: 'Paragraph' },
    { type: 'divider' },
    { disabled: true, key: 'disabled', label: 'Disabled' },
    { key: 'table', label: 'Table' },
  ];

  it('moves active key through selectable options', () => {
    expect(getNextSlashActiveKey(options, null, 'forward')).toBe('paragraph');
    expect(getNextSlashActiveKey(options, 'paragraph', 'forward')).toBe('table');
    expect(getNextSlashActiveKey(options, 'table', 'forward')).toBe('paragraph');
    expect(getNextSlashActiveKey(options, 'paragraph', 'backward')).toBe('table');
  });

  it('finds options by key', () => {
    expect(findSlashOptionByKey(options, 'table')?.label).toBe('Table');
    expect(findSlashOptionByKey(options, 'missing')).toBeNull();
  });

  it('moves active key spatially in grid layouts', () => {
    const gridOptions: ISlashOption[] = [
      { key: 'h1', label: 'H1', layout: 'compact' },
      { key: 'h2', label: 'H2', layout: 'compact' },
      { key: 'h3', label: 'H3', layout: 'compact' },
      { key: 'h4', label: 'H4', layout: 'compact' },
      { key: 'h5', label: 'H5', layout: 'compact' },
      { key: 'h6', label: 'H6', layout: 'compact' },
      { key: 'bullet', label: 'Bullet', layout: 'compact' },
      { key: 'ordered', label: 'Ordered', layout: 'compact' },
      { type: 'divider' },
      { key: 'image', label: 'Image', layout: 'tile' },
      { key: 'table', label: 'Table', layout: 'tile' },
      { key: 'file', label: 'File', layout: 'tile' },
      { key: 'status', label: 'Status', layout: 'tile' },
    ];

    expect(getNextSlashSpatialActiveKey(gridOptions, 'h1', 'right')).toBe('h2');
    expect(getNextSlashSpatialActiveKey(gridOptions, 'h1', 'down')).toBe('bullet');
    expect(getNextSlashSpatialActiveKey(gridOptions, 'table', 'down')).toBe('status');
    expect(getNextSlashSpatialActiveKey(gridOptions, 'status', 'up')).toBe('table');
  });
});
