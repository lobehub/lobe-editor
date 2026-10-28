'use client';

import { $isHeadingNode } from '@lexical/rich-text';
import { ActionIcon, toast } from '@lobehub/ui';
import { $getNearestNodeFromDOMNode } from 'lexical';
import { ChevronDownIcon, ChevronRightIcon, LinkIcon } from 'lucide-react';
import { type FC, useEffect, useReducer, useRef, useState } from 'react';

import { useLexicalEditor } from '@/editor-kernel/react';
import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { useTranslation } from '@/editor-kernel/react/useTranslation';

import { IHeadingService } from '../../service/i-heading-service';
import { styles } from './style';
import {
  copyTextToClipboard,
  getDefaultHeadingLink,
  getHeadingActionsPosition,
  HEADING_SELECTOR,
  type HeadingActionsPosition,
} from './utils';

export interface HeadingActionsProps {
  enableCopyLink?: boolean;
  enableFold?: boolean;
  getHeadingLink?: (slug: string) => string;
}

interface HoveredHeading {
  element: HTMLElement;
  key: string;
  position: HeadingActionsPosition;
}

const isSameHovered = (a: HoveredHeading | null, b: HoveredHeading | null) =>
  a?.key === b?.key &&
  a?.element === b?.element &&
  a?.position.left === b?.position.left &&
  a?.position.top === b?.position.top;

const HeadingActions: FC<HeadingActionsProps> = ({
  enableCopyLink = true,
  enableFold = true,
  getHeadingLink = getDefaultHeadingLink,
}) => {
  const [editor] = useLexicalComposerContext();
  const t = useTranslation();
  const actionsRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<HoveredHeading | null>(null);
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const service = editor.requireService(IHeadingService);

  useEffect(() => service?.subscribe(rerender), [service]);

  useLexicalEditor(
    (lexicalEditor) =>
      lexicalEditor.registerRootListener((root) => {
        const container = root?.parentElement;
        if (!root || !container) return;

        const handleMouseMove = (event: MouseEvent) => {
          const target = event.target as HTMLElement | null;
          if (!target || actionsRef.current?.contains(target)) return;

          const heading = target.closest<HTMLElement>(HEADING_SELECTOR);
          if (!heading || !root.contains(heading)) {
            setHovered(null);
            return;
          }

          const key = lexicalEditor.read(() => {
            const node = $getNearestNodeFromDOMNode(heading);
            return $isHeadingNode(node) ? node.getKey() : null;
          });
          const next = key
            ? { element: heading, key, position: getHeadingActionsPosition(heading, container) }
            : null;
          setHovered((prev) => (isSameHovered(prev, next) ? prev : next));
        };
        const handleMouseLeave = () => setHovered(null);

        container.addEventListener('mousemove', handleMouseMove);
        container.addEventListener('mouseleave', handleMouseLeave);
        return () => {
          container.removeEventListener('mousemove', handleMouseMove);
          container.removeEventListener('mouseleave', handleMouseLeave);
          setHovered(null);
        };
      }),
    [],
  );

  if (!hovered || !hovered.element.isConnected) return null;

  const slug = hovered.element.id || service?.getSlug(hovered.key);
  const folded = service?.isFolded(hovered.key) ?? false;
  const showCopyLink = enableCopyLink && Boolean(slug);
  const showFold = enableFold && Boolean(service);
  if (!showCopyLink && !showFold) return null;

  const handleCopyLink = async () => {
    if (!slug) return;
    await copyTextToClipboard(getHeadingLink(slug));
    toast.success(t('heading.copyLinkSuccess'));
  };

  return (
    <div
      className={styles.actions}
      contentEditable={false}
      data-heading-actions
      onMouseDown={(event) => event.preventDefault()}
      ref={actionsRef}
      style={hovered.position}
    >
      {showFold && (
        <ActionIcon
          icon={folded ? ChevronRightIcon : ChevronDownIcon}
          onClick={() => service?.toggleFolded(hovered.key)}
          size="small"
          title={t(folded ? 'heading.unfold' : 'heading.fold')}
        />
      )}
      {showCopyLink && (
        <ActionIcon
          icon={LinkIcon}
          onClick={handleCopyLink}
          size="small"
          title={t('heading.copyLink')}
        />
      )}
    </div>
  );
};

HeadingActions.displayName = 'HeadingActions';

export default HeadingActions;
