import { isValidElement, type ReactElement, type ReactNode } from 'react';

import locale from '@/locale';
import { FOOTNOTE_BACK_LINK_TEXT } from '@/plugins/footnote/node/FootnoteDefinitionNode';
import { styles } from '@/plugins/footnote/react/style';
import { $getCachedFootnoteState } from '@/plugins/footnote/utils';

const NUMBER_ATTRIBUTE = 'data-footnote-number';

function anchorId(prefix: string, identifier: string) {
  return `${prefix}-${encodeURIComponent(identifier)}`;
}

export function renderFootnote(node: Record<string, any>, key: string): ReactNode {
  const identifier = String(node.identifier ?? '');
  const state = $getCachedFootnoteState();
  const number = state?.numbers.get(identifier);
  const definition = state?.definitions.get(identifier);

  return (
    <sup className="editor_footnote" id={anchorId('fnref', identifier)} key={key}>
      <a
        className={styles.reference}
        data-footnote-missing={!definition}
        href={definition ? `#${anchorId('fn', identifier)}` : undefined}
        title={definition ? definition.text : locale.footnote.missingDefinition}
      >
        [{number ?? identifier}]
      </a>
    </sup>
  );
}

export function renderFootnoteDefinition(
  node: Record<string, any>,
  key: string,
  children: ReactNode[] | null,
): ReactNode {
  const identifier = String(node.identifier ?? '');
  const number = $getCachedFootnoteState()?.numbers.get(identifier);
  if (!number) return null;

  return (
    <li
      className={`editor_footnote_definition ${styles.definition}`}
      id={anchorId('fn', identifier)}
      key={key}
      value={number}
      {...{ [NUMBER_ATTRIBUTE]: number }}
    >
      <span data-footnote-label="true">{number}.</span>
      <span data-footnote-content="true">{children}</span>
      <a
        data-footnote-back="true"
        href={`#${anchorId('fnref', identifier)}`}
        title={locale.footnote.backToReference}
      >
        {FOOTNOTE_BACK_LINK_TEXT}
      </a>
    </li>
  );
}

function getNumber(child: ReactNode): number {
  if (!isValidElement(child)) return Number.MAX_SAFE_INTEGER;
  const value = (child as ReactElement<Record<string, unknown>>).props[NUMBER_ATTRIBUTE];
  return typeof value === 'number' ? value : Number.MAX_SAFE_INTEGER;
}

export function renderFootnoteSection(
  _node: Record<string, any>,
  key: string,
  children: ReactNode[] | null,
): ReactNode {
  const items = [...(children ?? [])].filter(Boolean).sort((a, b) => getNumber(a) - getNumber(b));
  if (items.length === 0) return null;

  return (
    <section className={`editor_footnote_section ${styles.section}`} key={key}>
      <ol>{items}</ol>
    </section>
  );
}
