import type { LexicalEditor } from 'lexical';
import { describe, expect, it } from 'vitest';

import { getTableResizePortalContainer } from '.';

const createEditor = (rootElement: HTMLElement | null) =>
  ({ getRootElement: () => rootElement }) as LexicalEditor;

describe('getTableResizePortalContainer', () => {
  it('mounts inside the dialog surface containing the editor', () => {
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const surface = document.createElement('div');
    const root = document.createElement('div');
    surface.append(root);
    dialog.append(surface);
    document.body.append(dialog);

    expect(getTableResizePortalContainer(createEditor(root))).toBe(surface);
  });

  it('falls back to the closest app container', () => {
    const app = document.createElement('div');
    app.className = 'ant-app';
    const root = document.createElement('div');
    app.append(root);
    document.body.append(app);

    expect(getTableResizePortalContainer(createEditor(root))).toBe(app);
  });
});
