'use client';

import { ActionIcon, Block, Flexbox, MaterialFileTypeIcon, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { Check, ChevronDown, ChevronRight, CopyIcon } from 'lucide-react';
import { type ReactNode, useCallback, useState } from 'react';

import { highlightCode } from '../engine/shiki';

const useStyles = createStaticStyles(
  ({ css, cssVar }) => css`
    cursor: default;

    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;

    width: 100%;
    margin-block: calc(var(--lobe-markdown-margin-multiple) * 0.5em);
    border-radius: var(--lobe-markdown-border-radius);

    background: ${cssVar.colorFillQuaternary};

    .renderer-cm-header {
      width: 100%;
    }

    .renderer-cm-code {
      width: 100%;
      border-block-start: 1px solid ${cssVar.colorFillQuaternary};
    }

    .renderer-cm-pre {
      overflow-x: auto;

      margin: 0;
      padding: 16px;

      font-family: ${cssVar.fontFamilyCode};
      font-size: calc(var(--lobe-markdown-font-size) * 0.85);
      line-height: 1.6;
      white-space: pre;

      background: transparent;

      code {
        font-family: inherit;
        font-size: inherit;
      }
    }

    .renderer-cm-collapsed {
      overflow: hidden;
      height: 0;
      border-block-start: none;
    }
  `,
);

function CodeBlockCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  }, [code]);

  return (
    <ActionIcon
      active={copied}
      icon={copied ? Check : CopyIcon}
      onClick={handleCopy}
      size="small"
      title="Copy"
    />
  );
}

function getLanguageName(lang: string): string {
  const names: Record<string, string> = {
    bash: 'Bash',
    c: 'C',
    cpp: 'C++',
    csharp: 'C#',
    css: 'CSS',
    dart: 'Dart',
    go: 'Go',
    graphql: 'GraphQL',
    html: 'HTML',
    java: 'Java',
    javascript: 'JavaScript',
    json: 'JSON',
    jsx: 'JSX',
    kotlin: 'Kotlin',
    lua: 'Lua',
    markdown: 'Markdown',
    php: 'PHP',
    python: 'Python',
    ruby: 'Ruby',
    rust: 'Rust',
    scss: 'SCSS',
    shell: 'Shell',
    sql: 'SQL',
    swift: 'Swift',
    tsx: 'TSX',
    typescript: 'TypeScript',
    xml: 'XML',
    yaml: 'YAML',
  };
  return names[lang] || lang.charAt(0).toUpperCase() + lang.slice(1);
}

function getFileExt(lang: string): string {
  const exts: Record<string, string> = {
    bash: 'sh',
    csharp: 'cs',
    javascript: 'js',
    kotlin: 'kt',
    markdown: 'md',
    python: 'py',
    ruby: 'rb',
    rust: 'rs',
    shell: 'sh',
    swift: 'swift',
    typescript: 'ts',
    yaml: 'yml',
  };
  return exts[lang] || lang;
}

function CodeBlockRenderer({
  node,
  codeChildren,
}: {
  codeChildren: ReactNode[] | null;
  node: Record<string, any>;
}) {
  const language = (node.language as string) || '';
  const code = (node.code as string) || '';
  const [expand, setExpand] = useState(true);

  const codeContent = codeChildren || highlightCode(code, language, 'cb') || code;

  return (
    <Block className={useStyles} variant="filled">
      <Flexbox
        align="center"
        className="renderer-cm-header"
        horizontal
        justify="space-between"
        padding={4}
      >
        <Flexbox align="center" gap={4} horizontal>
          {language && (
            <MaterialFileTypeIcon
              fallbackUnknownType={false}
              filename={`*.${getFileExt(language)}`}
              size={18}
              type="file"
              variant="raw"
            />
          )}
          <Text ellipsis fontSize={13}>
            {language ? getLanguageName(language) : 'Plain Text'}
          </Text>
        </Flexbox>
        <Flexbox gap={4} horizontal>
          <CodeBlockCopyButton code={code} />
          <ActionIcon
            icon={expand ? ChevronDown : ChevronRight}
            onClick={() => setExpand(!expand)}
            size="small"
          />
        </Flexbox>
      </Flexbox>

      <div className={expand ? 'renderer-cm-code' : 'renderer-cm-code renderer-cm-collapsed'}>
        <pre className="renderer-cm-pre">
          <code>{codeContent}</code>
        </pre>
      </div>
    </Block>
  );
}

export function renderCodeBlock(
  node: Record<string, any>,
  key: string,
  children: ReactNode[] | null,
): ReactNode {
  return <CodeBlockRenderer codeChildren={children} key={key} node={node} />;
}
