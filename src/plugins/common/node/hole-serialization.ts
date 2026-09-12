import type { SerializedLexicalNode } from 'lexical';

export type SerializedRecord = SerializedLexicalNode & {
  children?: SerializedLexicalNode[];
};

type SerializedMetadata = Record<string, any>;

const getRecordProperty = (
  record: SerializedRecord | Record<string, unknown>,
  key: string,
): SerializedMetadata | undefined => {
  const value = (record as Record<string, unknown>)[key];
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as SerializedMetadata)
    : undefined;
};

/**
 * Project runtime-only Hole boundaries out of persisted editor JSON.
 * Cursor nodes outside Hole (for example CodeNode's cursor) are preserved.
 *
 * The projection is intentionally pure: it allocates projected parents and
 * wrapper metadata without mutating the serialized input tree.
 */
export const projectRuntimeHolesForJSON = (node: SerializedRecord): SerializedRecord[] => {
  const children = Array.isArray(node.children) ? node.children : undefined;

  if (node.type === 'hole') {
    const projectedChildren = (children || [])
      .filter((child) => child.type !== 'cursor')
      .flatMap((child) => projectRuntimeHolesForJSON(child as SerializedRecord));

    // Hole is runtime-only, but annotations/provenance may have been attached
    // to its block host. Transfer that state to every projected payload node
    // before dropping the wrapper, otherwise a JSON round-trip silently
    // orphans block comments on Artifact/Hole content.
    const wrapperState = getRecordProperty(node, '$');
    if (!wrapperState) return projectedChildren;

    const wrapperProperties = getRecordProperty(wrapperState, 'properties');
    if (!wrapperProperties && Object.keys(wrapperState).length === 0) {
      return projectedChildren;
    }

    return projectedChildren.map((child) => {
      const childState = getRecordProperty(child, '$') || {};
      const childProperties = getRecordProperty(childState, 'properties');
      const mergedState = { ...wrapperState, ...childState };

      if (wrapperProperties || childProperties) {
        const mergedProperties: SerializedMetadata = {};
        if (wrapperProperties) Object.assign(mergedProperties, wrapperProperties);
        if (childProperties) Object.assign(mergedProperties, childProperties);
        const wrapperAnnotationIds = Array.isArray(wrapperProperties?.annotationIds)
          ? wrapperProperties.annotationIds.filter((id): id is string => typeof id === 'string')
          : [];
        const childAnnotationIds = Array.isArray(childProperties?.annotationIds)
          ? childProperties.annotationIds.filter((id): id is string => typeof id === 'string')
          : [];
        const annotationIds = Array.from(new Set([...wrapperAnnotationIds, ...childAnnotationIds]));
        if (annotationIds.length > 0) mergedProperties.annotationIds = annotationIds;
        else delete mergedProperties.annotationIds;
        mergedState.properties = mergedProperties;
      }

      return { ...child, $: mergedState } as SerializedRecord;
    });
  }

  if (!children) return [node];

  return [
    {
      ...node,
      children: children.flatMap((child) => projectRuntimeHolesForJSON(child as SerializedRecord)),
    } as SerializedRecord,
  ];
};
