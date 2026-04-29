export interface PaletteItem {
  group: string;
  key: string;
  label: string;
  pen: Record<string, unknown>;
}

const baseShape = {
  background: '#fff',
  color: '#1f1f1f',
  height: 60,
  lineWidth: 1,
  textColor: '#1f1f1f',
  width: 120,
};

export function getPalette(): PaletteItem[] {
  return [
    {
      group: 'Basic',
      key: 'rect',
      label: 'Rectangle',
      pen: { ...baseShape, name: 'rectangle', text: 'Rectangle' },
    },
    {
      group: 'Basic',
      key: 'roundRect',
      label: 'Rounded',
      pen: { ...baseShape, borderRadius: 0.2, name: 'rectangle', text: 'Rounded' },
    },
    {
      group: 'Basic',
      key: 'circle',
      label: 'Circle',
      pen: { ...baseShape, height: 80, name: 'circle', text: 'Circle', width: 80 },
    },
    {
      group: 'Basic',
      key: 'diamond',
      label: 'Diamond',
      pen: { ...baseShape, height: 100, name: 'diamond', text: 'Decision', width: 100 },
    },
    {
      group: 'Basic',
      key: 'line',
      label: 'Line',
      pen: { color: '#1f1f1f', height: 1, lineWidth: 1, name: 'line', width: 160 },
    },
    {
      group: 'Flow',
      key: 'flowData',
      label: 'Data',
      pen: { ...baseShape, name: 'flowData', text: 'Data' },
    },
    {
      group: 'Flow',
      key: 'flowDb',
      label: 'Database',
      pen: { ...baseShape, height: 100, name: 'flowDb', text: 'DB', width: 100 },
    },
    {
      group: 'Flow',
      key: 'flowDocument',
      label: 'Document',
      pen: { ...baseShape, name: 'flowDocument', text: 'Document' },
    },
  ];
}
