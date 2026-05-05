'use client';

import { createStyles } from 'antd-style';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useLexicalComposerContext } from '@/editor-kernel/react/react-context';
import { useTranslation } from '@/editor-kernel/react/useTranslation';

const useStyles = createStyles(({ css, token, prefixCls }) => ({
  actions: css`
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-block-start: 12px;
  `,
  backdrop: css`
    position: fixed;
    z-index: 1000;
    inset: 0;

    background: rgb(0 0 0 / 30%);

    animation: ${prefixCls}-fadeIn 0.15s ease;

    @keyframes ${prefixCls}-fadeIn {
      from {
        opacity: 0;
      }

      to {
        opacity: 1;
      }
    }
  `,
  btn: css`
    cursor: pointer;

    padding-block: 6px;
    padding-inline: 16px;
    border: 1px solid ${token.colorBorder};
    border-radius: ${token.borderRadius}px;

    font-size: 13px;

    transition: all 0.15s;
  `,
  btnCancel: css`
    color: ${token.colorTextSecondary};
    background: ${token.colorBgContainer};

    &:hover {
      color: ${token.colorText};
      background: ${token.colorFillSecondary};
    }
  `,
  btnConfirm: css`
    border-color: ${token.colorPrimary};
    color: #fff;
    background: ${token.colorPrimary};

    &:hover {
      opacity: 0.85;
    }
  `,
  card: css`
    position: fixed;
    z-index: 1001;
    inset-block-start: 20%;
    inset-inline-start: 50%;
    transform: translateX(-50%);

    width: calc(100vw - 48px);
    max-width: 520px;
    padding-block: 20px;
    padding-inline: 24px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;

    background: ${token.colorBgElevated};
    box-shadow: ${token.boxShadowSecondary};

    animation: ${prefixCls}-slideUp 0.2s ease;

    @keyframes ${prefixCls}-slideUp {
      from {
        transform: translateX(-50%) translateY(12px);
        opacity: 0;
      }

      to {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
    }
  `,
  description: css`
    margin-block-start: 8px;
    font-size: 14px;
    line-height: 1.5;
    color: ${token.colorTextSecondary};
  `,
  preview: css`
    overflow: auto;

    max-height: 180px;
    margin-block-start: 12px;
    padding-block: 10px;
    padding-inline: 12px;
    border-radius: ${token.borderRadius}px;

    font-family: ${token.fontFamilyCode};
    font-size: 12px;
    line-height: 1.5;
    color: ${token.colorTextSecondary};
    word-break: break-all;
    white-space: pre-wrap;

    background: ${token.colorFillTertiary};
  `,
  title: css`
    font-size: 16px;
    font-weight: 600;
    line-height: 1.4;
    color: ${token.colorText};
  `,
}));

interface PasteMarkdownConfirmProps {
  onCancel: () => void;
  onConfirm: () => void;
  text: string;
  visible: boolean;
}

export default function PasteMarkdownConfirm({
  text,
  visible,
  onConfirm,
  onCancel,
}: PasteMarkdownConfirmProps) {
  const { styles } = useStyles();
  const t = useTranslation();
  const [editor] = useLexicalComposerContext();
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus confirm button on open
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => confirmRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // Keyboard: Escape to cancel
  useEffect(() => {
    if (!visible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKey, { capture: true });
    return () => window.removeEventListener('keydown', handleKey, { capture: true });
  }, [visible, onCancel]);

  // Restore editor focus on close
  useEffect(() => {
    if (!visible) {
      editor?.focus();
    }
  }, [visible, editor]);

  if (!visible) return null;

  const preview = text.length > 300 ? text.slice(0, 300) + '...' : text;

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onCancel} />
      <div className={styles.card}>
        <div className={styles.title}>{t('markdown.pasteTitle')}</div>
        <div className={styles.description}>{t('markdown.pasteDescription')}</div>
        <pre className={styles.preview}>{preview}</pre>
        <div className={styles.actions}>
          <button className={`${styles.btn} ${styles.btnCancel}`} onClick={onCancel} type="button">
            {t('markdown.pasteCancel')}
          </button>
          <button
            className={`${styles.btn} ${styles.btnConfirm}`}
            onClick={onConfirm}
            ref={confirmRef}
            type="button"
          >
            {t('markdown.pasteConfirm')}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
