import { type CSSProperties, type ReactNode, createElement } from 'react';

import { getListClassName, getTableWrapperClassName } from '../style';
import { parseCSSText } from './utils';

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'sms:', 'tel:']);

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!SAFE_URL_PROTOCOLS.has(parsed.protocol)) {
      return 'about:blank';
    }
  } catch {
    return url;
  }
  return url;
}

function formatLinkHighlightUrl(url: string): string {
  if (/^[a-z][\d+.a-z-]*:/i.test(url)) {
    return url;
  }

  if (/^[#./]/.test(url)) {
    return url;
  }

  if (url.includes('@') && !url.startsWith('mailto:')) {
    return `mailto:${url}`;
  }

  if (/^\+?[\d\s()-]{5,}$/.test(url)) {
    return `tel:${url}`;
  }

  if (url.startsWith('www.')) {
    return `https://${url}`;
  }

  if (!url.includes('://')) {
    return `https://${url}`;
  }

  return url;
}

function textToSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replaceAll(/[^\s\w\u3000-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF-]/g, '')
    .replaceAll(/[\s_]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
}

const DIFF_ROOT_STYLE: CSSProperties = {
  position: 'relative',
};

const DIFF_LIST_ITEM_ROOT_STYLE: CSSProperties = {
  display: 'inline-block',
  minWidth: '100%',
  position: 'relative',
};

const DIFF_DELETED_STYLE: CSSProperties = {
  color: 'var(--ant-color-text-quaternary, rgba(0, 0, 0, 0.45))',
  textDecoration: 'line-through',
};

function renderDiffNode(
  node: Record<string, any>,
  key: string,
  children: ReactNode[] | null,
): ReactNode {
  const diffType = typeof node.diffType === 'string' ? node.diffType : 'unchanged';
  const renderedChildren = children ?? [];

  const sharedContentStyle: CSSProperties = {
    marginBlockStart: 'calc(var(--lobe-markdown-margin-multiple, 1) * 0.5em)',
    paddingInlineEnd: 4,
  };

  const borderColor =
    diffType === 'add' || diffType === 'listItemAdd'
      ? 'var(--ant-color-success, #52c41a)'
      : diffType === 'remove' || diffType === 'listItemRemove'
        ? 'var(--ant-color-error, #ff4d4f)'
        : 'var(--ant-color-warning, #faad14)';

  const contentStyle: CSSProperties =
    diffType === 'unchanged'
      ? sharedContentStyle
      : {
          ...sharedContentStyle,
          borderInlineEnd: `3px solid ${borderColor}`,
        };

  const rootStyle =
    diffType === 'listItemAdd' || diffType === 'listItemModify' || diffType === 'listItemRemove'
      ? DIFF_LIST_ITEM_ROOT_STYLE
      : DIFF_ROOT_STYLE;

  const wrapChild = (child: ReactNode | undefined, childKey: string, style?: CSSProperties) => {
    if (child === undefined || child === null) return null;

    return (
      <div key={childKey} style={style}>
        {child}
      </div>
    );
  };

  let content: ReactNode;

  switch (diffType) {
    case 'add':
    case 'listItemAdd': {
      content = wrapChild(renderedChildren[0], `${key}-add`);
      break;
    }
    case 'remove':
    case 'listItemRemove': {
      content = wrapChild(renderedChildren[0], `${key}-remove`, DIFF_DELETED_STYLE);
      break;
    }
    case 'modify':
    case 'listItemModify': {
      content = [
        wrapChild(renderedChildren[0], `${key}-old`, DIFF_DELETED_STYLE),
        wrapChild(renderedChildren[1], `${key}-new`),
      ];
      break;
    }
    default: {
      content = renderedChildren;
      break;
    }
  }

  return (
    <div className="ne-diff" data-diff-type={diffType} key={key} style={rootStyle}>
      <div className="content" style={contentStyle}>
        {content}
      </div>
    </div>
  );
}

export function renderBuiltinNode(
  node: Record<string, any>,
  key: string,
  children: ReactNode[] | null,
  headingSlugs: Map<string, number>,
  textContent?: string,
): ReactNode {
  switch (node.type) {
    case 'root': {
      return children;
    }
    case 'paragraph': {
      const style = node.format ? ({ textAlign: node.format } as const) : undefined;
      return (
        <p key={key} style={style}>
          {children}
        </p>
      );
    }
    case 'heading': {
      const tag = node.tag as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      const text = textContent || '';
      const baseSlug = textToSlug(text);
      let slug = baseSlug;
      if (baseSlug) {
        const count = headingSlugs.get(baseSlug);
        if (count !== undefined) {
          slug = `${baseSlug}-${count}`;
          headingSlugs.set(baseSlug, count + 1);
        } else {
          headingSlugs.set(baseSlug, 1);
        }
      }
      return createElement(tag, { id: slug || undefined, key }, children);
    }
    case 'quote': {
      return (
        <blockquote className="editor_quote" key={key}>
          {children}
        </blockquote>
      );
    }
    case 'list': {
      const Tag = node.listType === 'number' ? 'ol' : 'ul';
      const listClass = getListClassName(node.listType as string);
      return (
        <Tag className={listClass} key={key} start={node.start !== 1 ? node.start : undefined}>
          {children}
        </Tag>
      );
    }
    case 'listitem': {
      const isChecklist = node.checked !== undefined;
      const hasNestedList = node.children?.some((c: any) => c.type === 'list');
      const value = typeof node.value === 'number' && node.value > 1 ? node.value : undefined;

      let cls = 'editor_listItem';
      if (hasNestedList) {
        cls = 'editor_listItemNested';
      } else if (isChecklist) {
        cls = node.checked
          ? 'editor_listItem editor_listItemChecked'
          : 'editor_listItem editor_listItemUnchecked';
      }

      return (
        <li className={cls} key={key} role={isChecklist ? 'checkbox' : undefined} value={value}>
          {children}
        </li>
      );
    }
    case 'link':
    case 'autolink': {
      return (
        <a
          href={sanitizeUrl(node.url as string)}
          key={key}
          rel={node.rel || 'noopener noreferrer'}
          target={node.target || undefined}
        >
          {children}
        </a>
      );
    }
    case 'linkHighlight': {
      const url = textContent ? sanitizeUrl(formatLinkHighlightUrl(textContent)) : undefined;

      return (
        <a href={url} key={key} rel="noopener noreferrer" target="_blank">
          {children}
        </a>
      );
    }
    case 'table': {
      return (
        <div className={getTableWrapperClassName()} key={key}>
          <table className="editor_table">
            <tbody>{children}</tbody>
          </table>
        </div>
      );
    }
    case 'tablerow': {
      return <tr key={key}>{children}</tr>;
    }
    case 'tablecell': {
      const isHeader = !!node.headerState;
      const CellTag = isHeader ? 'th' : 'td';
      const cls = isHeader ? 'editor_table_cell editor_table_cell_header' : 'editor_table_cell';
      const cellStyle: Record<string, string> = {};
      if (node.width) cellStyle.width = `${node.width}px`;
      if (node.backgroundColor) cellStyle.backgroundColor = node.backgroundColor as string;
      if (node.verticalAlign) cellStyle.verticalAlign = node.verticalAlign as string;
      return (
        <CellTag
          className={cls}
          colSpan={node.colSpan > 1 ? node.colSpan : undefined}
          key={key}
          rowSpan={node.rowSpan > 1 ? node.rowSpan : undefined}
          style={Object.keys(cellStyle).length > 0 ? cellStyle : undefined}
        >
          {children}
        </CellTag>
      );
    }
    case 'linebreak': {
      return <br key={key} />;
    }
    case 'tab': {
      return <span key={key}>{'\t'}</span>;
    }
    case 'codeInline': {
      return (
        <code className="editor_code" key={key}>
          {children}
        </code>
      );
    }
    case 'code-highlight': {
      if (node.style) {
        return (
          <span key={key} style={parseCSSText(node.style as string)}>
            {node.text as string}
          </span>
        );
      }
      return <span key={key}>{node.text as string}</span>;
    }
    case 'diff': {
      return renderDiffNode(node, key, children);
    }
    case 'cursor': {
      return null;
    }
    default: {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[LexicalRenderer] Unknown node type: "${node.type}"`);
      }
      return children ?? null;
    }
  }
}
