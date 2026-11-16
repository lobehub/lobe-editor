// @vitest-environment node
import { LoroDoc, type TreeID } from 'loro-crdt';
import { describe, expect, it } from 'vitest';

import { LORO_LEXICAL_SCHEMA, LoroCanonicalDocument, createLoroBindingDescriptor } from '../index';

const commit = (doc: LoroCanonicalDocument, origin: string, callback: () => void) =>
  doc.commit(callback, { origin });

describe('LoroCanonicalDocument', () => {
  it('keeps durable nodeId separate from TreeID and stores fields in mergeable maps/text', () => {
    const canonical = new LoroCanonicalDocument(new LoroDoc());
    let paragraphId: TreeID | undefined;

    commit(canonical, 'loro:test/bootstrap', () => {
      const paragraph = canonical.createNode({
        attrs: { direction: 'ltr' },
        flow: 'Hello',
        nodeId: 'paragraph-1',
        properties: { annotationIds: ['a1'] },
        role: 'element',
        type: 'paragraph',
      });
      paragraphId = paragraph.id;
    });

    const node = canonical.findNodeById('paragraph-1');
    expect(node?.id).toBe(paragraphId);
    expect(canonical.readNode(node!).flow?.toString()).toBe('Hello');
    expect(canonical.readNode(node!).properties).toMatchObject({
      annotationIds: ['a1'],
      nodeId: 'paragraph-1',
    });
    expect(canonical.meta.get('schemaVersion')).toBe(LORO_LEXICAL_SCHEMA);
    expect(canonical.descriptor).toEqual(createLoroBindingDescriptor());
  });

  it('converges field-level attrs and rich text marks across replicas', () => {
    const seed = new LoroCanonicalDocument(new LoroDoc());
    let paragraphId!: TreeID;
    commit(seed, 'loro:test/seed', () => {
      paragraphId = seed.createNode({
        attrs: { direction: 'ltr', indent: 0, title: 'seed' },
        flow: 'hello',
        nodeId: 'paragraph-1',
        role: 'element',
        type: 'paragraph',
      }).id;
    });

    const snapshot = seed.exportSnapshot();
    const a = new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot));
    const b = new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot));
    a.doc.setPeerId('4101');
    b.doc.setPeerId('4102');

    const version = seed.doc.version();
    commit(a, 'human/text', () => {
      const node = a.getNode(paragraphId)!;
      const flow = a.readNode(node).flow!;
      flow.insert(flow.length, ' A');
      a.readNode(node).attrs;
      a.updateNodeFields(node, { attrs: { direction: 'rtl' } });
    });
    commit(b, 'agent/format', () => {
      const node = b.getNode(paragraphId)!;
      const flow = b.readNode(node).flow!;
      b.doc.configTextStyle({ lexical_format_bold: { expand: 'after' } });
      flow.mark({ start: 0, end: 5 }, 'lexical_format_bold', true);
      b.updateNodeFields(node, { attrs: { title: 'agent' } });
    });

    const updateA = a.exportUpdate(version);
    const updateB = b.exportUpdate(version);
    a.import(updateB);
    b.import(updateA);

    const aNode = a.findNodeById('paragraph-1')!;
    const bNode = b.findNodeById('paragraph-1')!;
    expect(a.readNode(aNode).flow?.toDelta()).toEqual(b.readNode(bNode).flow?.toDelta());
    expect(a.readNode(aNode).attrs).toEqual(b.readNode(bNode).attrs);
    expect(a.readNode(aNode).attrs).toMatchObject({ direction: 'rtl', indent: 0, title: 'agent' });
    expect(a.readNode(aNode).flow?.toString()).toBe('hello A');
  });

  it('preserves TreeID when a node moves across parents and delete wins visibility', () => {
    const seed = new LoroCanonicalDocument(new LoroDoc());
    let parentA: TreeID;
    let parentB: TreeID;
    let child!: TreeID;
    commit(seed, 'loro:test/seed', () => {
      parentA = seed.createNode({ role: 'element', type: 'quote', nodeId: 'a' }).id;
      parentB = seed.createNode({ role: 'element', type: 'quote', nodeId: 'b' }).id;
      child = seed.createNode({
        parent: parentA,
        role: 'element',
        type: 'paragraph',
        nodeId: 'child',
      }).id;
    });

    const snapshot = seed.exportSnapshot();
    const a = new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot));
    const b = new LoroCanonicalDocument(LoroDoc.fromSnapshot(snapshot));
    a.doc.setPeerId('4201');
    b.doc.setPeerId('4202');
    const version = seed.doc.version();

    commit(a, 'human/move', () => a.moveNode(child, parentB));
    commit(b, 'agent/delete', () => b.deleteNode(child));
    a.import(b.exportUpdate(version));
    b.import(a.exportUpdate(version));

    expect(a.getNode(child)?.id).toBe(child);
    expect(a.getNode(child)?.isDeleted()).toBe(true);
    expect(b.getNode(child)?.isDeleted()).toBe(true);
    expect(a.tree.toJSON()).toEqual(b.tree.toJSON());
  });
});
