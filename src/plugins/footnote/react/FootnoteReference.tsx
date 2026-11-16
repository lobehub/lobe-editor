'use client';

import { cx, Tooltip } from '@lobehub/ui';
import { type FC, useCallback, useMemo, useSyncExternalStore } from 'react';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { FOOTNOTE_JUMP_TO_DEFINITION_COMMAND } from '../command';
import type { FootnoteNode } from '../node/FootnoteNode';
import { type FootnoteSnapshot, IFootnoteService } from '../service';
import { styles } from './style';

interface FootnoteReferenceProps {
  className?: string;
  node: FootnoteNode;
}

const EMPTY_SNAPSHOT: FootnoteSnapshot = { definitions: {}, numbers: {} };
const noopSubscribe = () => () => {};

const FootnoteReference: FC<FootnoteReferenceProps> = ({ className, node }) => {
  const [editor] = useLexicalComposerContext();
  const t = useTranslation();
  const service = useMemo(() => editor.requireService(IFootnoteService), [editor]);
  const snapshot = useSyncExternalStore(
    service?.subscribe ?? noopSubscribe,
    service?.getSnapshot ?? (() => EMPTY_SNAPSHOT),
    service?.getSnapshot ?? (() => EMPTY_SNAPSHOT),
  );

  const identifier = node.__identifier;
  const number = snapshot.numbers[identifier];
  const definition = snapshot.definitions[identifier];
  const missing = definition === undefined;

  const handleClick = useCallback(() => {
    editor.dispatchCommand(FOOTNOTE_JUMP_TO_DEFINITION_COMMAND, identifier);
  }, [editor, identifier]);

  return (
    <Tooltip
      title={
        missing ? (
          <span className={styles.tooltipMissing}>{t('footnote.missingDefinition')}</span>
        ) : (
          <span className={styles.tooltip}>{definition || '…'}</span>
        )
      }
    >
      <span
        className={cx(styles.reference, className)}
        data-footnote-missing={missing}
        onClick={handleClick}
        onMouseDown={(event) => event.preventDefault()}
        role="link"
        tabIndex={-1}
      >
        [{number ?? identifier}]
      </span>
    </Tooltip>
  );
};

FootnoteReference.displayName = 'FootnoteReference';

export default FootnoteReference;
