/**
 * Registers all Meta2d shape libraries (aligned with mdocs `registerPens.ts`)
 * so palette items from flow / activity / sequence / class / FTA / charts work.
 */
import { activityDiagram, activityDiagramByCtx } from '@meta2d/activity-diagram';
import { register as registerChartDiagram } from '@meta2d/chart-diagram';
import { classPens as classPensLib } from '@meta2d/class-diagram';
import { register, registerAnchors, registerCanvasDraw } from '@meta2d/core';
import { flowAnchors, flowPens } from '@meta2d/flow-diagram';
import { formPens } from '@meta2d/form-diagram';
import { ftaAnchors, ftaPens, ftaPensbyCtx } from '@meta2d/fta-diagram';
import { chartsPens } from '@meta2d/le5le-charts';
import { sequencePens, sequencePensbyCtx } from '@meta2d/sequence-diagram';

let registered = false;

export function registerAllShapeLibraries(): void {
  if (registered) return;
  register(flowPens());
  registerAnchors(flowAnchors());
  register(activityDiagram());
  registerCanvasDraw(activityDiagramByCtx());
  register(classPensLib());
  register(sequencePens());
  registerCanvasDraw(sequencePensbyCtx());
  registerChartDiagram();
  registerCanvasDraw(formPens());
  registerCanvasDraw(chartsPens());
  register(ftaPens());
  registerCanvasDraw(ftaPensbyCtx());
  registerAnchors(ftaAnchors());
  registered = true;
}
