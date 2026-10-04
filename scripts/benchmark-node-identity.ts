/**
 * Reproducible, headless measurements for public NodeState identity operations.
 *
 * Run with: pnpm exec tsx scripts/benchmark-node-identity.ts
 * The values are diagnostic medians, not pass/fail timing assertions. Run each
 * revision on the same machine and avoid other CPU-heavy tasks while comparing.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $isTextNode,
  createEditor,
  type LexicalEditor,
  RootNode,
} from 'lexical';

import {
  $getNodeById,
  $getNodeId,
  $normalizeNodeIds,
  $setNodeId,
} from '../src/plugins/common/node/node-id';
import { registerNodeIdentityPolicy } from '../src/plugins/common/node/node-identity-policy';
import { NodeIdentityService } from '../src/plugins/common/service/node-identity-service';
import { liteXmlIdentityPolicy } from '../src/plugins/litexml/node/identity-policy';

const SIZES = [100, 1000, 5000];
const LOOKUPS = 1000;
const EDITS = 20;
const WARMUPS = 2;
const SAMPLES = 3;
const POLICIES = ['default', 'liteXml'] as const;

type PolicyMode = (typeof POLICIES)[number];

let checksum = 0;
let serial = 0;

type Metric = { medianMs: number; samplesMs: number[] };
type Measurement = {
  policy: PolicyMode;
  paragraphs: number;
  nodes: number;
  construction: Metric;
  repeatedTailLookupOneRead: Metric;
  repeatedTailLookupSeparateReads: Metric;
  repeatedTailLookupActiveUpdate: Metric;
  singleTextEdit: Metric;
  repeatedTextEdits: Metric;
  repeatedIdEdits: Metric;
  batchedIdEdits: Metric;
  serviceColdTailLookup: Metric;
  serviceWarmTailLookups: Metric;
};

function median(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function measure(run: () => void, warmups = WARMUPS, samples = SAMPLES): Metric {
  const times: number[] = [];
  for (let index = -warmups; index < samples; index++) {
    const start = performance.now();
    run();
    const elapsed = performance.now() - start;
    if (index >= 0) times.push(Number(elapsed.toFixed(3)));
  }
  return { medianMs: median(times), samplesMs: times };
}

function measureElapsed(run: () => number, warmups = WARMUPS, samples = SAMPLES): Metric {
  const times: number[] = [];
  for (let index = -warmups; index < samples; index++) {
    const elapsed = run();
    if (index >= 0) times.push(Number(elapsed.toFixed(3)));
  }
  return { medianMs: median(times), samplesMs: times };
}

function readCommitted<T>(editor: LexicalEditor, reader: () => T): T {
  return editor.getEditorState().read(reader, { editor });
}

function newEditor(policy: PolicyMode): LexicalEditor {
  const editor = createEditor({
    namespace: 'node-identity-benchmark',
    onError(error) {
      throw error;
    },
  });
  if (policy === 'liteXml') registerNodeIdentityPolicy(editor, liteXmlIdentityPolicy);
  editor.registerNodeTransform(RootNode, $normalizeNodeIds);
  return editor;
}

function createDocument(
  paragraphs: number,
  policy: PolicyMode,
): {
  editor: LexicalEditor;
  firstTextKey: string;
  tailTextKey: string;
  tailTextId: string;
  textKeys: string[];
} {
  const editor = newEditor(policy);
  const textKeys: string[] = [];
  editor.update(
    () => {
      const root = $getRoot();
      for (let index = 0; index < paragraphs; index++) {
        const paragraph = $createParagraphNode();
        const text = $createTextNode(`paragraph ${index}`);
        paragraph.append(text);
        root.append(paragraph);
        textKeys.push(text.getKey());
      }
    },
    { discrete: true },
  );
  const tailTextKey = textKeys.at(-1)!;
  const tailTextId = readCommitted(editor, () => {
    const node = $getNodeByKey(tailTextKey);
    if (!$isTextNode(node)) throw new Error('Tail text is missing after construction.');
    const id = $getNodeId(node);
    if (!id) throw new Error('Root transform did not assign a public ID.');
    return id;
  });
  return { editor, firstTextKey: textKeys[0], tailTextKey, tailTextId, textKeys };
}

function updateText(editor: LexicalEditor, textKey: string): void {
  const value = `edited ${++serial}`;
  editor.update(
    () => {
      const node = $getNodeByKey(textKey);
      if (!$isTextNode(node)) throw new Error(`Text node ${textKey} went missing.`);
      node.setTextContent(value);
    },
    { discrete: true },
  );
}

function updateId(editor: LexicalEditor, textKey: string): void {
  const id = `benchmark-id-${++serial}`;
  editor.update(
    () => {
      const node = $getNodeByKey(textKey);
      if (!$isTextNode(node)) throw new Error(`Text node ${textKey} went missing.`);
      $setNodeId(node, id);
    },
    { discrete: true },
  );
}

function benchmark(paragraphs: number, policy: PolicyMode): Measurement {
  let document: ReturnType<typeof createDocument> | undefined;
  const construction = measure(
    () => {
      document = createDocument(paragraphs, policy);
    },
    1,
    SAMPLES,
  );
  if (!document) throw new Error('Document construction failed.');
  const { editor, firstTextKey, tailTextId, textKeys } = document;
  const editKeys = textKeys.slice(0, EDITS);
  const initialEditIds = readCommitted(editor, () =>
    editKeys.map((key) => {
      const node = $getNodeByKey(key);
      if (!$isTextNode(node)) throw new Error(`Text node ${key} went missing.`);
      const id = $getNodeId(node);
      if (!id) throw new Error(`Text node ${key} has no public ID.`);
      return id;
    }),
  );

  const repeatedTailLookupOneRead = measure(() => {
    readCommitted(editor, () => {
      for (let index = 0; index < LOOKUPS; index++) {
        const node = $getNodeById(tailTextId);
        if (!node) throw new Error('Tail lookup failed.');
        checksum += node.getKey().length;
      }
    });
  });
  const repeatedTailLookupSeparateReads = measure(() => {
    for (let index = 0; index < LOOKUPS; index++) {
      readCommitted(editor, () => {
        const node = $getNodeById(tailTextId);
        if (!node) throw new Error('Tail lookup failed.');
        checksum += node.getKey().length;
      });
    }
  });
  const repeatedTailLookupActiveUpdate = measureElapsed(() => {
    let elapsed = 0;
    editor.update(
      () => {
        const first = $getNodeByKey(firstTextKey);
        if (!$isTextNode(first)) throw new Error('First text node went missing.');
        const activeId = `benchmark-active-${++serial}`;
        $setNodeId(first, activeId);
        if ($getNodeById(activeId)?.getKey() !== firstTextKey) {
          throw new Error('Fresh ID is invisible inside the active update.');
        }
        const start = performance.now();
        for (let index = 0; index < LOOKUPS; index++) {
          const node = $getNodeById(tailTextId);
          if (!node) throw new Error('Tail lookup failed inside an active update.');
          checksum += node.getKey().length;
        }
        elapsed = performance.now() - start;
      },
      { discrete: true },
    );
    return elapsed;
  });
  const singleTextEdit = measure(() => updateText(editor, firstTextKey));
  const repeatedTextEdits = measure(
    () => {
      for (const key of editKeys) updateText(editor, key);
    },
    1,
    SAMPLES,
  );
  const repeatedIdEdits = measure(
    () => {
      for (const key of editKeys) updateId(editor, key);
    },
    1,
    SAMPLES,
  );
  const batchedIdEdits = measure(() => {
    editor.update(
      () => {
        for (const key of editKeys) {
          const node = $getNodeByKey(key);
          if (!$isTextNode(node)) throw new Error(`Text node ${key} went missing.`);
          $setNodeId(node, `benchmark-id-${++serial}`);
        }
      },
      { discrete: true },
    );
  });
  readCommitted(editor, () => {
    for (let index = 0; index < editKeys.length; index++) {
      const key = editKeys[index];
      const node = $getNodeByKey(key);
      if (!$isTextNode(node)) throw new Error(`Text node ${key} went missing after ID edits.`);
      const id = $getNodeId(node);
      if (!id || $getNodeById(id)?.getKey() !== key) {
        throw new Error(`Current ID of text node ${key} cannot be resolved.`);
      }
      if ($getNodeById(initialEditIds[index])) {
        throw new Error(`Original ID of text node ${key} is stale.`);
      }
    }
  });
  const service = new NodeIdentityService();
  const unbind = service.bindEditor(editor);
  const serviceColdTailLookup = measureElapsed(() => {
    updateText(editor, firstTextKey);
    const start = performance.now();
    const snapshot = service.getNodeById(tailTextId);
    const elapsed = performance.now() - start;
    if (snapshot?.id !== tailTextId) throw new Error('Cold service lookup failed.');
    checksum += snapshot.textContent.length;
    return elapsed;
  });
  const serviceWarmTailLookups = measure(() => {
    for (let index = 0; index < LOOKUPS; index++) {
      const snapshot = service.getNodeById(tailTextId);
      if (snapshot?.id !== tailTextId) throw new Error('Warm service lookup failed.');
      checksum += snapshot.textContent.length;
    }
  });
  unbind();
  return {
    policy,
    paragraphs,
    nodes: paragraphs * 2,
    construction,
    repeatedTailLookupOneRead,
    repeatedTailLookupSeparateReads,
    repeatedTailLookupActiveUpdate,
    singleTextEdit,
    repeatedTextEdits,
    repeatedIdEdits,
    batchedIdEdits,
    serviceColdTailLookup,
    serviceWarmTailLookups,
  };
}

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const source = readFileSync(new URL('../src/plugins/common/node/node-id.ts', import.meta.url));
const sourceHash = createHash('sha256').update(source).digest('hex');
const policyRegistrySource = readFileSync(
  new URL('../src/plugins/common/node/node-identity-policy.ts', import.meta.url),
);
const policyRegistrySourceHash = createHash('sha256').update(policyRegistrySource).digest('hex');
const policySource = readFileSync(
  new URL('../src/plugins/litexml/node/identity-policy.ts', import.meta.url),
);
const policySourceHash = createHash('sha256').update(policySource).digest('hex');
const serviceContractSource = readFileSync(
  new URL('../src/plugins/common/service/i-node-identity-service.ts', import.meta.url),
);
const serviceContractSourceHash = createHash('sha256').update(serviceContractSource).digest('hex');
const serviceSource = readFileSync(
  new URL('../src/plugins/common/service/node-identity-service.ts', import.meta.url),
);
const serviceSourceHash = createHash('sha256').update(serviceSource).digest('hex');
const benchmarkSource = readFileSync(new URL(import.meta.url));
const benchmarkSourceHash = createHash('sha256').update(benchmarkSource).digest('hex');
const output = {
  commit,
  sourceHash,
  policyRegistrySourceHash,
  policySourceHash,
  serviceContractSourceHash,
  serviceSourceHash,
  benchmarkSourceHash,
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  parameters: {
    sizes: SIZES,
    policies: POLICIES,
    lookups: LOOKUPS,
    edits: EDITS,
    warmups: WARMUPS,
    samples: SAMPLES,
  },
  measurements: POLICIES.flatMap((policy) => SIZES.map((size) => benchmark(size, policy))),
  checksum,
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
