type SerializedNode = Record<string, any>;

const isRecord = (value: unknown): value is SerializedNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Lexical 0.53 enforces TableRowNode's child structure while parsing editor
 * state. Legacy table diffs stored as `tablerow > diff > tablecell` therefore
 * have to be migrated in the serialized tree, before Lexical can discard the
 * now-invalid wrapper and its cells.
 */
export function migrateLegacyTableCellDiffs(root: unknown): unknown {
  const visit = (node: unknown, path: string): unknown => {
    if (!isRecord(node)) return node;

    const children = Array.isArray(node.children) ? (node.children as unknown[]) : null;
    if (!children) return { ...node };

    const clone = { ...node };
    if (node.type === 'tablerow') {
      const migratedChildren: unknown[] = [];
      children.forEach((child, index) => {
        if (
          isRecord(child) &&
          child.type === 'diff' &&
          (child.diffType === 'add' || child.diffType === 'remove') &&
          Array.isArray(child.children)
        ) {
          const cells = child.children.filter(
            (candidate: unknown) => isRecord(candidate) && candidate.type === 'tablecell',
          ) as SerializedNode[];
          if (cells.length > 0) {
            const changeId = `legacy-table-cell:${path}.${index}`;
            cells.forEach((cell) => {
              const migratedCell = visit(cell, `${path}.${index}.${migratedChildren.length}`);
              if (!isRecord(migratedCell)) return;
              migratedChildren.push({
                ...migratedCell,
                children: [
                  {
                    children: migratedCell.children,
                    diffType: child.diffType,
                    direction: null,
                    format: '',
                    indent: 0,
                    type: 'diff',
                    version: 1,
                  },
                ],
                changeId,
                diffType: child.diffType,
                type: 'table-cell-diff',
              });
            });
            return;
          }
        }

        migratedChildren.push(visit(child, `${path}.${index}`));
      });
      clone.children = migratedChildren;
      return clone;
    }

    clone.children = children.map((child, index) => visit(child, `${path}.${index}`));
    return clone;
  };

  return visit(root, 'root');
}
