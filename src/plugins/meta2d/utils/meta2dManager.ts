import { Meta2d, isShowChild } from '@meta2d/core';
import C2S from 'canvas2svg';

import { registerAllShapeLibraries } from './registerPens';

let shapesReady = false;
const DEFAULT_STROKE_COLOR = '#1f1f1f';
const DEFAULT_LINE_WIDTH = 1;
const NO_DEFAULT_STROKE_NAMES = new Set(['text']);

export function createEmptyMeta2dData(): Record<string, unknown> {
  return { pens: [] };
}

/** Canonical empty diagram JSON for new blocks and markdown defaults. */
export const EMPTY_META2D_DIAGRAM_JSON = JSON.stringify(createEmptyMeta2dData());

/** Inline SVG used when the canvas has no drawable content yet (HUD + layout need a truthy svg). */
export const EMPTY_META2D_PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="100%" height="100%" fill="#fafafa" stroke="#eee"/></svg>';

/** When loading from markdown without cached svg, use placeholder for empty diagrams to avoid async flicker. */
export function initialSvgForDiagram(diagram: string): string {
  if (!diagram.trim()) return EMPTY_META2D_PLACEHOLDER_SVG;
  try {
    const data = JSON.parse(diagram) as { pens?: unknown[] };
    if (data && Array.isArray(data.pens) && data.pens.length === 0) {
      return EMPTY_META2D_PLACEHOLDER_SVG;
    }
  } catch {
    // ignore
  }
  return '';
}

export function ensureMeta2dShapes(): void {
  if (shapesReady) return;
  registerAllShapeLibraries();
  shapesReady = true;
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function shouldApplyDefaultStroke(pen: Record<string, any>): boolean {
  return !NO_DEFAULT_STROKE_NAMES.has(String(pen.name ?? ''));
}

export function normalizeMeta2dPen(pen: Record<string, any>): Record<string, any> {
  if (shouldApplyDefaultStroke(pen)) {
    if (pen.color === undefined && pen.strokeStyle === undefined) {
      pen.color = DEFAULT_STROKE_COLOR;
    }
    if (pen.lineWidth === undefined && pen.strokeStyle !== 'transparent') {
      pen.lineWidth = DEFAULT_LINE_WIDTH;
    }
  }

  if (pen.text && pen.textColor === undefined) {
    pen.textColor = DEFAULT_STROKE_COLOR;
  }

  return pen;
}

export function normalizeMeta2dData(data: unknown): unknown {
  if (!isRecord(data) || !Array.isArray(data.pens)) return data;
  data.pens.forEach((pen) => {
    if (isRecord(pen)) normalizeMeta2dPen(pen);
  });
  return data;
}

export function sanitizeMeta2dData(data: unknown): unknown {
  return JSON.parse(
    JSON.stringify(data, (key, value) => {
      if (key === '__meta__' || key === 'calculative') return undefined;
      return value;
    }),
  );
}

function destroyEngine(engine: Meta2d | null, host: HTMLDivElement) {
  try {
    engine?.destroy();
  } catch {
    // ignore
  }
  try {
    host.remove();
  } catch {
    // ignore
  }
}

function patchCanvas2SvgFont(ctx: any) {
  let rawFontValue = ctx.font;
  Object.defineProperty(ctx, 'font', {
    configurable: true,
    get: () => rawFontValue,
    set: (value: string) => {
      rawFontValue =
        typeof value === 'string'
          ? value.replace(
              /(\d+(?:\.\d+)?(?:px|pt|pc|em|ex|%|in|cm|mm))\s*\/\s*(\d+(?:\.\d+)?)(?=\s|$)/,
              '$1/normal',
            )
          : value;
      if (ctx.__ctx) {
        ctx.__ctx.font = rawFontValue;
      }
    },
  });
}

function patchCanvas2SvgEllipse(ctx: any) {
  if (typeof ctx.ellipse === 'function') return;

  ctx.ellipse = (
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation = 0,
    startAngle = 0,
    endAngle = Math.PI * 2,
    counterclockwise = false,
  ) => {
    if (radiusX < 0 || radiusY < 0) {
      throw new Error('IndexSizeError: The radius provided is negative.');
    }

    if (ctx.__currentElement?.nodeName !== 'path') {
      ctx.beginPath();
    }

    const twoPi = Math.PI * 2;
    const delta = Math.abs(endAngle - startAngle);
    const fullEllipse = delta >= twoPi - 0.0001 || delta === 0;
    const rotationDeg = (rotation * 180) / Math.PI;
    const sweepFlag = counterclockwise ? 0 : 1;

    const pointAt = (angle: number) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rotateCos = Math.cos(rotation);
      const rotateSin = Math.sin(rotation);

      return {
        x: x + radiusX * cos * rotateCos - radiusY * sin * rotateSin,
        y: y + radiusX * cos * rotateSin + radiusY * sin * rotateCos,
      };
    };

    const addArc = (largeArcFlag: 0 | 1, end: { x: number; y: number }) => {
      ctx.__addPathCommand(
        `A ${radiusX} ${radiusY} ${rotationDeg} ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`,
      );
      ctx.__currentPosition = end;
    };

    const start = pointAt(startAngle);
    ctx.moveTo(start.x, start.y);

    if (fullEllipse) {
      const mid = pointAt(startAngle + Math.PI);
      addArc(1, mid);
      addArc(1, start);
      return;
    }

    const end = pointAt(endAngle);
    addArc(delta > Math.PI ? 1 : 0, end);
  };
}

function waitFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function waitForMeta2dRender() {
  await waitFrame();
  await waitFrame();
}

function resolveCanvas2SvgCtor():
  | (new (
      width: number,
      height: number,
    ) => {
      __ctx?: { font?: string };
      font?: string;
      getSerializedSvg?: () => string;
      strokeStyle?: string;
      textBaseline?: string;
    })
  | null {
  const moduleCtor =
    (C2S as unknown as { default?: unknown }).default ??
    (C2S as unknown as { C2S?: unknown }).C2S ??
    C2S;
  if (typeof moduleCtor === 'function') {
    return moduleCtor as new (width: number, height: number) => any;
  }
  const windowCtor = (window as unknown as { C2S?: unknown }).C2S;
  if (typeof windowCtor === 'function') {
    return windowCtor as new (width: number, height: number) => any;
  }
  return null;
}

export async function generateSvgFromMeta2d(
  engine: Meta2d,
  Canvas2SvgCtor = resolveCanvas2SvgCtor(),
): Promise<string> {
  if (!Canvas2SvgCtor) {
    console.error('[meta2d] preview failed: canvas2svg constructor missing');
    return '';
  }

  normalizeMeta2dData(engine.data());
  engine.render(true);
  await waitForMeta2dRender();

  const store = (engine as any).store;
  const pens = store?.data?.pens;
  const penCount = Array.isArray(pens) ? pens.length : 0;

  const padding = 10;
  const sourceRect = engine.getRect() as {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  const boundsBad =
    !sourceRect ||
    !Number.isFinite(sourceRect.width) ||
    !Number.isFinite(sourceRect.height) ||
    sourceRect.width <= 0 ||
    sourceRect.height <= 0;

  if (boundsBad) {
    if (penCount === 0) return EMPTY_META2D_PLACEHOLDER_SVG;
    console.error('[meta2d] preview failed: invalid bounds', sourceRect);
    return '';
  }

  const rect = {
    ...sourceRect,
    x: sourceRect.x - padding,
    y: sourceRect.y - padding,
  };
  const ctx = new Canvas2SvgCtor(
    Math.ceil(sourceRect.width + padding * 2),
    Math.ceil(sourceRect.height + padding * 2),
  );

  ctx.textBaseline = 'middle';
  ctx.strokeStyle = store?.styles?.color || DEFAULT_STROKE_COLOR;
  patchCanvas2SvgFont(ctx);
  patchCanvas2SvgEllipse(ctx);

  if (Array.isArray(pens) && store) {
    for (const pen of pens) {
      if (pen?.visible === false || !isShowChild(pen, store)) continue;
      try {
        (engine as any).renderPenRaw(ctx, pen, rect, true);
      } catch (error) {
        console.error('[meta2d] preview failed: render pen', pen, error);
      }
    }
  }

  const svg = ctx.getSerializedSvg?.()?.replace(/--le5le--/g, '&#x') ?? '';
  if (!svg.trim()) {
    if (penCount === 0) return EMPTY_META2D_PLACEHOLDER_SVG;
    console.error('[meta2d] preview failed: serialized SVG is empty', {
      pensCount: penCount,
    });
    return '';
  }

  return svg;
}

export async function generateSvgFromDiagram(diagramJson: string): Promise<string> {
  const Canvas2SvgCtor = resolveCanvas2SvgCtor();
  if (!Canvas2SvgCtor) {
    console.error('[meta2d] preview failed: canvas2svg constructor missing');
    return '';
  }

  ensureMeta2dShapes();
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-20000px;top:0;width:1200px;height:800px;pointer-events:none;z-index:-1;';
  document.body.append(host);

  let engine: Meta2d | null = null;
  try {
    let parsed: unknown;
    try {
      parsed = JSON.parse(diagramJson);
    } catch (error) {
      console.error('[meta2d] preview failed: invalid diagram JSON', error, diagramJson);
      return '';
    }

    engine = new Meta2d(host, { background: '#fff', grid: false, rule: false });
    normalizeMeta2dData(parsed);
    engine.open(parsed as never);
    engine.render(true);

    await waitForMeta2dRender();
    return generateSvgFromMeta2d(engine, Canvas2SvgCtor);
  } catch (error) {
    console.error('[meta2d] preview failed: unexpected error', error);
    return '';
  } finally {
    destroyEngine(engine, host);
  }
}
