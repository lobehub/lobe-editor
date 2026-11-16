import { mergeRegister } from '@lexical/utils';
import type { LexicalEditor } from 'lexical';
import { $getNodeByKey, $insertNodes, COMMAND_PRIORITY_EDITOR, createCommand } from 'lexical';

import { $createChartNodeFromSource, $isChartNode } from '../node/ChartNode';
import { type ChartSpec, parseChartSpec } from '../utils/spec';

export interface InsertChartPayload {
  spec?: ChartSpec | string;
}

export interface UpdateChartPayload {
  key: string;
  spec: ChartSpec | string;
}

export const INSERT_CHART_COMMAND = createCommand<InsertChartPayload | undefined>(
  'INSERT_CHART_COMMAND',
);

export const UPDATE_CHART_COMMAND = createCommand<UpdateChartPayload>('UPDATE_CHART_COMMAND');

export const DEFAULT_CHART_SPEC: ChartSpec = {
  version: 1,
  type: 'bar',
  title: 'Monthly revenue',
  x: 'month',
  series: [{ key: 'revenue', label: 'Revenue' }],
  data: [
    { month: 'Jan', revenue: 120 },
    { month: 'Feb', revenue: 160 },
    { month: 'Mar', revenue: 140 },
  ],
};

export function registerChartCommand(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerCommand(
      INSERT_CHART_COMMAND,
      (payload) => {
        const spec = payload?.spec ?? DEFAULT_CHART_SPEC;
        const source = typeof spec === 'string' ? spec : JSON.stringify(spec, null, 2);
        editor.update(() => {
          $insertNodes([$createChartNodeFromSource(source)]);
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
    editor.registerCommand(
      UPDATE_CHART_COMMAND,
      ({ key, spec }) => {
        const result = parseChartSpec(spec);
        if (!result.ok) return false;
        editor.update(() => {
          const node = $getNodeByKey(key);
          if ($isChartNode(node)) node.setSpec(result.spec);
        });
        return true;
      },
      COMMAND_PRIORITY_EDITOR,
    ),
  );
}
