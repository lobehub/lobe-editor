import type { SerializedLexicalNode } from 'lexical';
import { describe, expect, it } from 'vitest';

import { projectRuntimeHolesForJSON as projectFromJSONDataSource } from './json-data-source';
import { projectRuntimeHolesForJSON } from '../node/hole-serialization';

const project = projectRuntimeHolesForJSON;

describe('projectRuntimeHolesForJSON', () => {
  it('keeps the JSONDataSource compatibility export pointed at the pure projector', () => {
    expect(projectFromJSONDataSource).toBe(projectRuntimeHolesForJSON);
  });

  it('recursively flattens Hole wrappers while preserving business ids, properties, and non-Hole cursors', () => {
    const [root] = projectRuntimeHolesForJSON({
      children: [
        {
          children: [
            { text: '\uFEFF', type: 'cursor', version: 1 },
            {
              html: '<main>persisted</main>',
              id: 'artifact-id',
              properties: { annotationIds: ['comment-id'] },
              title: 'Persisted',
              type: 'artifact',
              version: 1,
            },
            { text: '\uFEFF', type: 'cursor', version: 1 },
          ],
          id: 'runtime-hole',
          type: 'hole',
          version: 1,
        },
        {
          children: [
            {
              children: [
                { text: '\uFEFF', type: 'cursor', version: 1 },
                { text: 'code', type: 'text', version: 1 },
              ],
              type: 'codeInline',
              version: 1,
            },
          ],
          type: 'paragraph',
          version: 1,
        },
      ],
      type: 'root',
      version: 1,
    } as unknown as SerializedLexicalNode & { children: SerializedLexicalNode[] });

    expect(root.children?.[0]).toMatchObject({
      html: '<main>persisted</main>',
      id: 'artifact-id',
      properties: { annotationIds: ['comment-id'] },
      type: 'artifact',
    });
    expect(JSON.stringify(root)).not.toContain('runtime-hole');
    expect(root.children?.[1]).toMatchObject({
      children: [
        {
          children: [{ type: 'cursor' }, { text: 'code', type: 'text' }],
          type: 'codeInline',
        },
      ],
      type: 'paragraph',
    });
  });

  it('transfers runtime Hole properties to projected payload nodes', () => {
    const [root] = projectRuntimeHolesForJSON({
      children: [
        {
          $: {
            properties: {
              annotationIds: ['hole-comment'],
              custom: 'wrapper-property',
            },
          },
          children: [
            { text: '\uFEFF', type: 'cursor', version: 1 },
            {
              $: { properties: { annotationIds: ['artifact-comment'], custom: 'artifact' } },
              html: '<main>payload</main>',
              type: 'artifact',
              version: 1,
            },
            { text: '\uFEFF', type: 'cursor', version: 1 },
          ],
          type: 'hole',
          version: 1,
        },
      ],
      type: 'root',
      version: 1,
    } as unknown as SerializedLexicalNode & { children: SerializedLexicalNode[] });

    expect(root.children?.[0]).toMatchObject({
      $: {
        properties: {
          annotationIds: ['hole-comment', 'artifact-comment'],
          custom: 'artifact',
        },
      },
      type: 'artifact',
    });
  });

  it('preserves mixed forest order, nested content, metadata, and non-Hole cursors without mutation', () => {
    const input = {
      children: [
        {
          children: [{ text: 'before', type: 'text', version: 1 }],
          type: 'paragraph',
          version: 1,
        },
        {
          $: {
            provenance: { source: 'wrapper' },
            properties: { annotationIds: ['outer'], shared: 'wrapper' },
          },
          children: [
            { text: '\uFEFF', type: 'cursor', version: 1 },
            {
              $: {
                provenance: { source: 'payload' },
                properties: { annotationIds: ['inner'], shared: 'payload' },
              },
              children: [
                {
                  children: [
                    { text: '\uFEFF', type: 'cursor', version: 1 },
                    { text: 'nested', type: 'text', version: 1 },
                    { text: '\uFEFF', type: 'cursor', version: 1 },
                  ],
                  type: 'codeInline',
                  version: 1,
                },
              ],
              type: 'artifact',
              version: 1,
            },
            { text: '\uFEFF', type: 'cursor', version: 1 },
          ],
          type: 'hole',
          version: 1,
        },
        {
          children: [{ text: 'after', type: 'text', version: 1 }],
          type: 'paragraph',
          version: 1,
        },
        {
          children: [{ text: '\uFEFF', type: 'cursor', version: 1 }],
          type: 'code',
          version: 1,
        },
      ],
      type: 'root',
      version: 1,
    } as unknown as SerializedLexicalNode & { children: SerializedLexicalNode[] };
    const before = structuredClone(input);

    const [projected] = project(input);

    expect(projected.children?.map((child) => child.type)).toEqual([
      'paragraph',
      'artifact',
      'paragraph',
      'code',
    ]);
    expect(projected.children?.[1]).toMatchObject({
      $: {
        provenance: { source: 'payload' },
        properties: {
          annotationIds: ['outer', 'inner'],
          shared: 'payload',
        },
      },
      children: [
        {
          children: [{ type: 'cursor' }, { text: 'nested' }, { type: 'cursor' }],
          type: 'codeInline',
        },
      ],
      type: 'artifact',
    });
    expect(input).toEqual(before);
    expect(project(projected)).toEqual([projected]);
  });
});
