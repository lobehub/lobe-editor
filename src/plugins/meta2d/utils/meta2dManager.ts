import { Meta2d, isShowChild } from '@meta2d/core';
import C2S from 'canvas2svg';

import { registerAllShapeLibraries } from './registerPens';

let shapesReady = false;

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

function waitFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function resolveCanvas2SvgCtor():
  | (new (
      width: number,
      height: number,
    ) => {
      __ctx?: { font?: string };
      font?: string;
      getSerializedSvg?: () => string;
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
    engine.open(parsed as never);
    engine.render(true);

    await waitFrame();
    await waitFrame();

    const pens = (engine as any).store?.data?.pens;
    const penCount = Array.isArray(pens) ? pens.length : 0;

    // Align with Meta2d `downloadSvg`: expand rect by padding on x/y only; C2S size is width+2*pad × height+2*pad;
    // `renderPenRaw` takes the same rect object (do not pass inflated width/height — only translate uses x/y).
    const padding = 10;
    const rect = engine.getRect() as {
      height: number;
      width: number;
      x: number;
      y: number;
    };
    const boundsBad =
      !rect ||
      !Number.isFinite(rect.width) ||
      !Number.isFinite(rect.height) ||
      rect.width <= 0 ||
      rect.height <= 0;

    if (boundsBad) {
      if (penCount === 0) return EMPTY_META2D_PLACEHOLDER_SVG;
      console.error('[meta2d] preview failed: invalid bounds', rect);
      return '';
    }

    rect.x -= padding;
    rect.y -= padding;

    const ctx = new Canvas2SvgCtor(
      Math.ceil(rect.width + padding * 2),
      Math.ceil(rect.height + padding * 2),
    );
    ctx.textBaseline = 'middle';
    patchCanvas2SvgFont(ctx);

    const store = (engine as any).store;
    if (Array.isArray(pens) && store) {
      for (const pen of pens) {
        if (pen?.visible === false || !isShowChild(pen, store)) continue;
        try {
          (engine as any).renderPenRaw(ctx, pen, rect, true);
        } catch {
          // skip invalid pen
        }
      }
    }
    const svg = ctx.getSerializedSvg?.()?.replace(/--le5le--/g, '&#x') ?? '';
    if (!svg.trim()) {
      if (penCount === 0) return EMPTY_META2D_PLACEHOLDER_SVG;
      console.error('[meta2d] preview failed: serialized SVG is empty', {
        diagramJson,
        pensCount: penCount,
      });
      return '';
    }
    return svg;
  } catch (error) {
    console.error('[meta2d] preview failed: unexpected error', error);
    return '';
  } finally {
    destroyEngine(engine, host);
  }
}
