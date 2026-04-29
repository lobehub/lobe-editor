/**
 * Palette definitions aligned with mdocs `diagram-pens.ts` and expanded from
 * meta2d.js `examples/diagram-editor-vue3` (`Graphics.vue`).
 */
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
    // —— Basic (Vue「基本形状」+ mdocs basics)
    {
      group: 'Basic',
      key: 'square',
      label: 'Square',
      pen: { ...baseShape, height: 100, name: 'square', text: '', width: 100 },
    },
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
      key: 'triangle',
      label: 'Triangle',
      pen: { ...baseShape, height: 90, name: 'triangle', text: 'Triangle', width: 100 },
    },
    {
      group: 'Basic',
      key: 'diamond',
      label: 'Diamond',
      pen: { ...baseShape, height: 100, name: 'diamond', text: 'Decision', width: 100 },
    },
    {
      group: 'Basic',
      key: 'pentagon',
      label: 'Pentagon',
      pen: { ...baseShape, height: 100, name: 'pentagon', text: 'Pentagon', width: 100 },
    },
    {
      group: 'Basic',
      key: 'hexagon',
      label: 'Hexagon',
      pen: { ...baseShape, height: 100, name: 'hexagon', text: 'Hexagon', width: 100 },
    },
    {
      group: 'Basic',
      key: 'pentagram',
      label: 'Star',
      pen: { ...baseShape, height: 100, name: 'pentagram', text: '', width: 100 },
    },
    {
      group: 'Basic',
      key: 'leftArrow',
      label: 'Left arrow',
      pen: { height: 60, name: 'leftArrow', width: 120 },
    },
    {
      group: 'Basic',
      key: 'rightArrow',
      label: 'Right arrow',
      pen: { height: 60, name: 'rightArrow', width: 120 },
    },
    {
      group: 'Basic',
      key: 'twowayArrow',
      label: 'Two-way',
      pen: { height: 60, name: 'twowayArrow', width: 150 },
    },
    {
      group: 'Basic',
      key: 'cloud',
      label: 'Cloud',
      pen: { height: 100, name: 'cloud', width: 100 },
    },
    {
      group: 'Basic',
      key: 'message',
      label: 'Message',
      pen: { height: 100, name: 'message', textTop: -0.1, width: 100 },
    },
    {
      group: 'Basic',
      key: 'file',
      label: 'File',
      pen: { height: 100, name: 'file', width: 80 },
    },
    {
      group: 'Basic',
      key: 'cube',
      label: 'Cube',
      pen: { height: 100, name: 'cube', width: 60, z: 0.25 },
    },
    {
      group: 'Basic',
      key: 'people',
      label: 'Actor',
      pen: { height: 100, name: 'people', width: 70 },
    },
    {
      group: 'Basic',
      key: 'text',
      label: 'Text',
      pen: {
        ...baseShape,
        background: 'transparent',
        color: 'transparent',
        height: 32,
        name: 'text',
        text: 'text',
        width: 120,
      },
    },
    {
      group: 'Basic',
      key: 'line',
      label: 'Line',
      pen: { color: '#1f1f1f', height: 1, lineWidth: 1, name: 'line', width: 160 },
    },

    // —— Flow (mdocs + Vue「流程图」)
    {
      group: 'Flow',
      key: 'flowTerminal',
      label: 'Terminal',
      pen: {
        ...baseShape,
        borderRadius: 0.5,
        height: 40,
        name: 'rectangle',
        text: 'Start / End',
        width: 120,
      },
    },
    {
      group: 'Flow',
      key: 'flowProcess',
      label: 'Process',
      pen: { ...baseShape, height: 40, name: 'rectangle', text: 'Process', width: 120 },
    },
    {
      group: 'Flow',
      key: 'flowDecision',
      label: 'Decision',
      pen: { ...baseShape, height: 60, name: 'diamond', text: 'Decision', width: 120 },
    },
    {
      group: 'Flow',
      key: 'flowData',
      label: 'Data',
      pen: { ...baseShape, name: 'flowData', offsetX: 0.14, text: 'Data' },
    },
    {
      group: 'Flow',
      key: 'flowPrepare',
      label: 'Prepare',
      pen: { ...baseShape, height: 50, name: 'hexagon', text: 'Prepare', width: 120 },
    },
    {
      group: 'Flow',
      key: 'flowSubprocess',
      label: 'Subprocess',
      pen: { ...baseShape, height: 50, name: 'flowSubprocess', text: 'Subprocess', width: 120 },
    },
    {
      group: 'Flow',
      key: 'flowDb',
      label: 'Database',
      pen: { ...baseShape, height: 100, name: 'flowDb', text: 'DB', width: 80 },
    },
    {
      group: 'Flow',
      key: 'flowDocument',
      label: 'Document',
      pen: { ...baseShape, height: 100, name: 'flowDocument', text: 'Document', width: 120 },
    },
    {
      group: 'Flow',
      key: 'flowInternalStorage',
      label: 'Int. storage',
      pen: {
        ...baseShape,
        height: 80,
        name: 'flowInternalStorage',
        text: 'Internal',
        width: 120,
      },
    },
    {
      group: 'Flow',
      key: 'flowExternStorage',
      label: 'Ext. storage',
      pen: {
        ...baseShape,
        height: 80,
        name: 'flowExternStorage',
        text: 'External',
        width: 120,
      },
    },
    {
      group: 'Flow',
      key: 'flowQueue',
      label: 'Queue',
      pen: { ...baseShape, height: 100, name: 'flowQueue', text: 'Queue', width: 100 },
    },
    {
      group: 'Flow',
      key: 'flowManually',
      label: 'Manual input',
      pen: { ...baseShape, height: 80, name: 'flowManually', text: 'Manual', width: 120 },
    },
    {
      group: 'Flow',
      key: 'flowDisplay',
      label: 'Display',
      pen: { ...baseShape, height: 80, name: 'flowDisplay', text: 'Display', width: 120 },
    },
    {
      group: 'Flow',
      key: 'flowParallel',
      label: 'Parallel',
      pen: { ...baseShape, height: 50, name: 'flowParallel', text: 'Parallel', width: 120 },
    },
    {
      group: 'Flow',
      key: 'flowComment',
      label: 'Comment',
      pen: { ...baseShape, height: 100, name: 'flowComment', text: 'Note', width: 100 },
    },

    // —— Activity (Vue「活动图」)
    {
      group: 'Activity',
      key: 'actStart',
      label: 'Start',
      pen: {
        background: '#555',
        height: 30,
        lineWidth: 0,
        name: 'circle',
        text: '',
        width: 30,
      },
    },
    {
      group: 'Activity',
      key: 'actFinal',
      label: 'Final',
      pen: { height: 30, name: 'activityFinal', width: 30 },
    },
    {
      group: 'Activity',
      key: 'actStep',
      label: 'Action',
      pen: {
        ...baseShape,
        borderRadius: 0.25,
        height: 50,
        name: 'rectangle',
        text: 'Action',
        width: 120,
      },
    },
    {
      group: 'Activity',
      key: 'actMerge',
      label: 'Merge',
      pen: { ...baseShape, height: 50, name: 'diamond', text: 'Merge', width: 120 },
    },
    {
      group: 'Activity',
      key: 'swimlaneV',
      label: 'Swimlane V',
      pen: {
        height: 500,
        lineTop: 0.08,
        name: 'swimlaneV',
        text: 'Swimlane',
        textBaseline: 'top',
        textTop: 20,
        width: 200,
      },
    },
    {
      group: 'Activity',
      key: 'swimlaneH',
      label: 'Swimlane H',
      pen: {
        height: 200,
        lineLeft: 0.08,
        name: 'swimlaneH',
        text: 'Swimlane',
        textAlign: 'left',
        textLeft: 0.04,
        textWidth: 0.01,
        width: 500,
      },
    },
    {
      group: 'Activity',
      key: 'forkV',
      label: 'Fork V',
      pen: {
        fillStyle: '#555',
        height: 150,
        name: 'forkV',
        strokeStyle: 'transparent',
        text: '',
        width: 10,
      },
    },
    {
      group: 'Activity',
      key: 'forkH',
      label: 'Fork H',
      pen: {
        fillStyle: '#555',
        height: 10,
        name: 'forkH',
        strokeStyle: 'transparent',
        text: '',
        width: 150,
      },
    },

    // —— Sequence / class (Vue「时序图和类图」)
    {
      group: 'Sequence & class',
      key: 'lifeline',
      label: 'Lifeline',
      pen: {
        height: 400,
        name: 'lifeline',
        text: 'Object',
        textHeight: 50,
        width: 150,
      },
    },
    {
      group: 'Sequence & class',
      key: 'sequenceFocus',
      label: 'Activation',
      pen: { height: 200, name: 'sequenceFocus', text: '', width: 12 },
    },
    {
      group: 'Sequence & class',
      key: 'simpleClass',
      label: 'Simple class',
      pen: {
        height: 200,
        list: [{ text: '- name: string\n+ setName(name: string): void' }],
        name: 'simpleClass',
        text: 'ClassName',
        textAlign: 'center',
        textBaseline: 'top',
        textHeight: 200,
        textTop: 10,
        width: 270,
      },
    },
    {
      group: 'Sequence & class',
      key: 'interfaceClass',
      label: 'Class',
      pen: {
        height: 200,
        list: [{ text: '- name: string' }, { text: '+ setName(name: string): void' }],
        name: 'interfaceClass',
        text: 'ClassName',
        textAlign: 'center',
        textBaseline: 'top',
        textHeight: 200,
        textTop: 10,
        width: 270,
      },
    },

    // —— Fault tree (Vue「故障树」子集)
    {
      group: 'Fault tree',
      key: 'andGate',
      label: 'AND gate',
      pen: { height: 150, name: 'andGate', width: 100 },
    },
    {
      group: 'Fault tree',
      key: 'orGate',
      label: 'OR gate',
      pen: { height: 150, name: 'orGate', width: 100 },
    },
    {
      group: 'Fault tree',
      key: 'basicEvent',
      label: 'Basic event',
      pen: { height: 150, name: 'basicEvent', width: 100 },
    },
    {
      group: 'Fault tree',
      key: 'xorGate',
      label: 'XOR gate',
      pen: { height: 150, name: 'xorGate', width: 100 },
    },
    {
      group: 'Fault tree',
      key: 'votingGate',
      label: 'Voting gate',
      pen: { height: 150, name: 'votingGate', width: 100 },
    },
  ];
}
