import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { JSDOM, VirtualConsole } from 'jsdom';

const domErrors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (error) => domErrors.push(error));
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
  virtualConsole,
});
const { window } = dom;
const nativeMutationObserver = window.MutationObserver;
const trackedMutationObservers = [];

class TrackingMutationObserver {
  constructor(callback) {
    this.callback = callback;
    this.targets = [];
    this.disconnected = false;
    this.native = new nativeMutationObserver((records) => callback(records, this));
    trackedMutationObservers.push(this);
  }

  observe(target, options) {
    this.targets.push(target);
    this.native.observe(target, options);
  }

  disconnect() {
    this.disconnected = true;
    this.native.disconnect();
  }

  takeRecords() {
    return this.native.takeRecords();
  }
}

for (const [name, value] of Object.entries({
  AbortController: window.AbortController,
  AbortSignal: window.AbortSignal,
  Document: window.Document,
  Element: window.Element,
  HTMLElement: window.HTMLElement,
  HTMLTableElement: window.HTMLTableElement,
  MutationObserver: TrackingMutationObserver,
  Node: window.Node,
  Text: window.Text,
  document: window.document,
  getComputedStyle: window.getComputedStyle.bind(window),
  navigator: window.navigator,
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  window,
})) {
  Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
}

window.MutationObserver = TrackingMutationObserver;
window.addEventListener('error', (event) => {
  domErrors.push(event.error ?? new Error(event.message));
  event.preventDefault();
});

const moduleMode = process.env.TABLE_MODULE_MODE;
let lexical;
let table;
if (moduleMode === 'require') {
  const require = createRequire(import.meta.url);
  lexical = require('lexical');
  table = require('@lexical/table');
} else if (moduleMode === 'import') {
  lexical = await import('lexical');
  table = await import('@lexical/table');
} else {
  throw new Error(`Unknown table package module mode: ${moduleMode}`);
}

const editor = lexical.createEditor({
  nodes: [table.TableNode, table.TableRowNode, table.TableCellNode],
  onError: (error) => {
    throw error;
  },
});
const root = document.createElement('div');
root.contentEditable = 'true';
document.body.append(root);
const unregisterTablePlugin = table.registerTablePlugin(editor);
const unregisterTableObserver = table.registerTableSelectionObserver(editor);
editor.setRootElement(root);

const waitForMutationFlush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

let tableKey;
editor.update(
  () => {
    const tableNode = table.$createTableNodeWithDimensions(1, 1, false);
    tableKey = tableNode.getKey();
    lexical.$getRoot().append(tableNode);
  },
  { discrete: true },
);
await waitForMutationFlush();

const tableNode = editor.getEditorState().read(() => lexical.$getNodeByKey(tableKey));
assert.ok(table.$isTableNode(tableNode));
const tableDOM = editor.getElementByKey(tableKey);
assert.ok(tableDOM);
const tableElement = tableNode.getDOMSlot(tableDOM).element;
assert.equal(tableElement.nodeName, 'TABLE');
const tableObserver = table.getTableObserverFromTableElement(tableElement);
assert.ok(tableObserver, 'TableObserver is attached to the rendered table');
const trackedObserver = trackedMutationObservers.find((observer) =>
  observer.targets.includes(tableElement),
);
assert.ok(trackedObserver, 'TableObserver MutationObserver watches the table element');

tableElement.querySelector('tr')?.setAttribute('data-active-mutation', 'true');
await waitForMutationFlush();
assert.equal(
  domErrors.length,
  0,
  `live table mutations are processed while the TableNode exists: ${domErrors.map((error) => error.stack ?? error).join('\n')}`,
);

editor.update(
  () => {
    const current = lexical.$getNodeByKey(tableKey);
    assert.ok(table.$isTableNode(current));
    current.remove();
    lexical.$getRoot().append(lexical.$createParagraphNode());
  },
  { discrete: true },
);
await waitForMutationFlush();
assert.equal(trackedObserver.disconnected, true, 'removing a table disconnects its observer');

// A MutationObserver callback may already be queued when Lexical destroys its
// TableNode. Exercise that exact stale callback while the editor remains live.
let staleCallbackError;
try {
  trackedObserver.callback([{ target: tableElement, type: 'attributes' }], trackedObserver);
} catch (error) {
  staleCallbackError = error;
}
assert.equal(staleCallbackError, undefined, 'a queued callback ignores a removed TableNode');
await waitForMutationFlush();
assert.equal(
  domErrors.length,
  0,
  `table replacement emits no asynchronous observer errors: ${domErrors.map((error) => error.stack ?? error).join('\n')}`,
);

unregisterTableObserver();
unregisterTablePlugin();
editor.setRootElement(null);
window.close();
