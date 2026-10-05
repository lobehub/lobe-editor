#!/usr/bin/env node

/**
 * Exercise the emitted Node package across bundled and unbundled entries.
 * Run after build: node scripts/verify-node-identity-package.mjs [package-root]
 * The optional root may point at an extracted npm package with its dependencies installed.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { accessSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = resolve(dirname(scriptPath), '..');
const args = process.argv.slice(2);
const packageRoot = resolve(args.find((arg) => !arg.startsWith('--')) ?? defaultRoot);
const childMode = args
  .find((arg) => arg.startsWith('--child-mode='))
  ?.slice('--child-mode='.length);
const importOrder = args.find((arg) => arg.startsWith('--order='))?.slice('--order='.length);

const entryPaths = {
  headless: join(packageRoot, 'es/headless.js'),
  nodeId: join(packageRoot, 'es/plugins/common/node/node-id.js'),
  serviceToken: join(packageRoot, 'es/plugins/common/service/i-node-identity-service.js'),
};

for (const [name, file] of Object.entries(entryPaths)) {
  try {
    accessSync(file);
  } catch {
    throw new Error(`Missing built ${name} entry: ${file}. Build the package first.`);
  }
}

if (!childMode) {
  for (const mode of ['development', 'production']) {
    for (const order of ['headless-first', 'leaf-first']) {
      const result = spawnSync(
        process.execPath,
        [scriptPath, packageRoot, `--child-mode=${mode}`, `--order=${order}`],
        { env: { ...process.env, NODE_ENV: mode }, stdio: 'inherit' },
      );
      if (result.error) throw result.error;
      assert.equal(result.status, 0, `Node identity package verification failed: ${mode}/${order}`);
    }
  }
  console.log('Node identity package verification passed in development and production.');
} else {
  assert.ok(['development', 'production'].includes(childMode), `Unknown child mode: ${childMode}`);
  assert.ok(
    ['headless-first', 'leaf-first'].includes(importOrder),
    `Unknown import order: ${importOrder}`,
  );
  assert.equal(process.env.NODE_ENV, childMode, 'Child process must set NODE_ENV before imports.');

  const urls = Object.fromEntries(
    Object.entries(entryPaths).map(([name, file]) => [name, pathToFileURL(file).href]),
  );
  let headless;
  let nodeId;
  let serviceToken;
  if (importOrder === 'headless-first') {
    headless = await import(urls.headless);
    nodeId = await import(urls.nodeId);
    serviceToken = await import(urls.serviceToken);
  } else {
    serviceToken = await import(urls.serviceToken);
    nodeId = await import(urls.nodeId);
    headless = await import(urls.headless);
  }

  const { $getNodeById, $getNodeId, $setNodeId } = nodeId;
  const { INodeIdentityService } = serviceToken;
  assert.equal(typeof headless.createHeadlessEditor, 'function');
  assert.equal(typeof $getNodeById, 'function');
  assert.equal(typeof $getNodeId, 'function');
  assert.equal(typeof $setNodeId, 'function');
  assert.ok(INodeIdentityService);
  assert.equal(
    headless.$getNodeById,
    $getNodeById,
    'Headless public lookup must share the leaf NodeState module.',
  );
  assert.equal(
    headless.$getNodeId,
    $getNodeId,
    'Headless public ID reader must share the leaf module.',
  );
  assert.equal(
    headless.INodeIdentityService,
    INodeIdentityService,
    'Headless public service token must share the leaf token.',
  );

  const first = headless.createHeadlessEditor();
  const second = headless.createHeadlessEditor();
  let firstDestroyed = false;
  try {
    first.hydrateLiteXML(
      '<root><p id="paragraph-one"><span id="text-one">Before</span></p></root>',
    );
    second.hydrateLiteXML(
      '<root><p id="paragraph-one"><span id="text-one">Second</span></p></root>',
    );

    const firstLexical = first.kernel.getLexicalEditor();
    const secondLexical = second.kernel.getLexicalEditor();
    assert.ok(firstLexical);
    assert.ok(secondLexical);
    const firstService = first.kernel.requireService(INodeIdentityService);
    const secondService = second.kernel.requireService(INodeIdentityService);
    assert.ok(firstService, 'The leaf service token must resolve the bundled headless service.');
    assert.ok(secondService);
    assert.notEqual(firstService, secondService);

    const readActive = (editor, id) =>
      editor.getEditorState().read(
        () => {
          const node = $getNodeById(id);
          return node
            ? { id: $getNodeId(node), key: node.getKey(), text: node.getTextContent() }
            : null;
        },
        { editor },
      );

    assert.equal(readActive(firstLexical, 'text-one')?.text, 'Before');
    assert.equal(readActive(secondLexical, 'text-one')?.text, 'Second');
    assert.equal(firstService.getNodeById('text-one')?.textContent, 'Before');
    assert.equal(secondService.getNodeById('text-one')?.textContent, 'Second');

    const detached = firstService.getNodeById('paragraph-one');
    assert.equal(detached?.textContent, 'Before');
    Reflect.set(detached, 'textContent', 'Tampered');
    assert.equal(firstService.getNodeById('paragraph-one')?.textContent, 'Before');

    const beforeUpdate = firstLexical.getEditorState();
    const updateErrors = [];
    first.kernel.on('error', (error) => updateErrors.push(error));
    firstLexical.update(() => {
      const text = $getNodeById('text-one');
      assert.ok(text, 'Leaf lookup must see the bundled editor node during an update.');
      $setNodeId(text, 'renamed-text');
      assert.equal($getNodeById('text-one'), null);
      assert.equal($getNodeById('renamed-text')?.getKey(), text.getKey());
    });
    await new Promise((done) => setImmediate(done));
    assert.deepEqual(updateErrors, []);
    assert.equal(readActive(firstLexical, 'text-one'), null);
    assert.equal(readActive(firstLexical, 'renamed-text')?.text, 'Before');
    assert.equal(firstService.getNodeById('renamed-text')?.textContent, 'Before');
    assert.equal(secondService.getNodeById('text-one')?.textContent, 'Second');
    assert.equal(
      beforeUpdate.read(() => $getNodeById('text-one')?.getTextContent(), {
        editor: firstLexical,
      }),
      'Before',
    );

    await first.applyLiteXML({
      action: 'replace',
      delay: true,
      litexml: '<p id="paragraph-one">After</p>',
    });
    assert.equal(readActive(firstLexical, 'paragraph-one')?.text, 'After');
    assert.equal(firstService.getNodeById('paragraph-one')?.textContent, 'After');
    assert.equal(secondService.getNodeById('paragraph-one')?.textContent, 'Second');
    assert.equal(detached.textContent, 'Before', 'A detached snapshot must remain independent.');

    const serializedNodes = [];
    const collect = (node) => {
      serializedNodes.push(node);
      for (const child of node.children ?? []) collect(child);
    };
    collect(first.export().editorData.root);
    assert.ok(
      serializedNodes.some((node) => node.type === 'diff' && node.diffType === 'modify'),
      'The delayed replacement must retain a pending review diff.',
    );
    assert.ok(serializedNodes.some((node) => node.text === 'Before'));
    assert.ok(serializedNodes.some((node) => node.text === 'After'));

    first.destroy();
    firstDestroyed = true;
    assert.equal(first.kernel.requireService(INodeIdentityService), null);
    assert.equal(firstService.getNodeById('paragraph-one'), null);
    console.log(`Verified ${childMode}/${importOrder}: bundled headless + leaf identity entries.`);
  } finally {
    if (!firstDestroyed) first.destroy();
    second.destroy();
  }
}
