import { Meta2d, register, registerAnchors } from '@meta2d/core';
import { flowAnchors, flowPens } from '@meta2d/flow-diagram';
import C2S from 'canvas2svg';

let shapesReady = false;

export const DEFAULT_META2D_DIAGRAM_JSON = JSON.stringify({
  pens: [
    {
      height: 60,
      name: 'rectangle',
      text: '开始',
      width: 180,
      x: 120,
      y: 120,
    },
  ],
  version: '1.0.0',
});

export function createEmptyMeta2dData(): Record<string, unknown> {
  return { pens: [] };
}

export function ensureMeta2dShapes(): void {
  if (shapesReady) return;
  register(flowPens());
  registerAnchors(flowAnchors());
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

    const bounds = engine.getRect();
    if (
      !bounds ||
      !Number.isFinite(bounds.width) ||
      !Number.isFinite(bounds.height) ||
      typeof bounds.width !== 'number' ||
      typeof bounds.height !== 'number'
    ) {
      console.error('[meta2d] preview failed: invalid bounds', bounds);
      return '';
    }

    const padding = 10;
    const x = (bounds.x ?? 0) - padding;
    const y = (bounds.y ?? 0) - padding;
    const width = Math.ceil(bounds.width + padding * 2);
    const height = Math.ceil(bounds.height + padding * 2);

    const ctx = new Canvas2SvgCtor(width, height);
    ctx.textBaseline = 'middle';
    patchCanvas2SvgFont(ctx);

    const pens = (engine as any).store?.data?.pens;
    if (Array.isArray(pens)) {
      for (const pen of pens) {
        if (pen?.visible === false) continue;
        try {
          (engine as any).renderPenRaw(ctx, pen, { height, width, x, y }, true);
        } catch {
          // skip invalid pen
        }
      }
    }
    const svg = ctx.getSerializedSvg?.()?.replace(/--le5le--/g, '&#x') ?? '';
    if (!svg) {
      console.error('[meta2d] preview failed: serialized SVG is empty', {
        diagramJson,
        pensCount: Array.isArray(pens) ? pens.length : -1,
      });
    }
    return svg;
  } catch (error) {
    console.error('[meta2d] preview failed: unexpected error', error);
    return '';
  } finally {
    destroyEngine(engine, host);
  }
}
