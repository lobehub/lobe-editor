import { Block, Center } from '@lobehub/ui';
import { Features, type FeaturesProps } from '@lobehub/ui/awesome';
import { Github } from '@lobehub/ui/icons';
import { createStaticStyles } from 'antd-style';
import { Puzzle, Slash, Zap } from 'lucide-react';
import { type ComponentType, useEffect, useState } from 'react';

const description =
  "A powerful and extensible rich text editor built on Meta's Lexical framework, providing a modern editing experience with React integration.";

const styles = createStaticStyles(({ css }) => ({
  accent: css`
    color: transparent;
    background: var(--docs-gradient-spectral);
    background-clip: text;
  `,
  action: css`
    cursor: pointer;

    display: inline-flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;

    min-width: 9.375rem;
    min-height: 2.8125rem;
    padding-inline: 1.5rem;
    border: 1px solid transparent;
    border-radius: 0.75rem;

    font-size: 1rem;
    font-weight: 600;
    color: var(--docs-text-primary);
    text-decoration: none;

    background-image:
      linear-gradient(var(--docs-surface-raised), var(--docs-surface-raised)),
      var(--docs-gradient-spectral);
    background-clip: padding-box, border-box;
    background-origin: border-box;
    box-shadow: var(--docs-shadow-control);

    transition:
      background-color 140ms ease,
      filter 140ms ease,
      transform 90ms ease;

    &:hover {
      background-image:
        linear-gradient(var(--docs-surface-hover), var(--docs-surface-hover)),
        var(--docs-gradient-spectral);
    }

    &:active {
      transform: scale(0.97);
    }
  `,
  actions: css`
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-block-start: 1.5rem;

    @media (width <= 47.5rem) {
      flex-direction: column;
      width: 100%;
    }
  `,
  content: css`
    width: 100%;
  `,
  hero: css`
    isolation: isolate;
    position: relative;

    display: flex;
    align-items: center;
    justify-content: center;

    width: 100vw;
    min-height: 29.25rem;
    margin-inline: calc(50% - 50vw);
    padding-block: 8.25rem 3rem;
    padding-inline: 1.5rem;

    text-align: center;

    &::before {
      pointer-events: none;
      content: '';

      position: absolute;
      z-index: -1;
      inset: 0;
      inset-block-start: -55px;

      background:
        radial-gradient(42% 68% at 24% 18%, var(--docs-aurora-violet), transparent 72%),
        radial-gradient(38% 72% at 67% 6%, var(--docs-aurora-blue), transparent 72%),
        radial-gradient(32% 62% at 90% 24%, var(--docs-aurora-pink), transparent 72%);
    }

    @media (width <= 47.5rem) {
      min-height: 40rem;
      padding-block: 8rem 3.75rem;
      padding-inline: 1.5rem;
    }
  `,
  heroInner: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    width: min(100%, 64rem);

    h1 {
      display: flex;
      flex-wrap: wrap;
      gap: 0 0.18em;
      justify-content: center;

      margin: 0;

      font-size: clamp(4rem, 7.8125vw, 6.25rem);
      font-weight: 500;
      line-height: 1.2;
      color: var(--docs-text-primary);
      letter-spacing: -0.045em;
    }

    p {
      max-width: 54rem;
      margin-block: 0;
      margin-inline: 0;

      font-size: 1.5rem;
      line-height: 1.5714;
      color: var(--docs-text-secondary);
      text-wrap: balance;
    }

    @media (width <= 47.5rem) {
      h1 {
        font-size: 4rem;
      }

      p {
        max-width: 19.375rem;
        margin-block: 1.5rem 0;
        font-size: 1rem;
        line-height: 1.5714;
      }
    }
  `,
  primaryAction: css`
    && {
      color: var(--docs-background);
      background: var(--docs-text-primary);
    }

    &&:hover {
      background: color-mix(in srgb, var(--docs-text-primary) 86%, var(--docs-background));
    }
  `,
  root: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  `,
}));

interface EditorDemoProps {
  collapsible?: boolean;
  defaultActiveKey?: string[];
}

const EditorPreview = () => {
  const [Editor, setEditor] = useState<ComponentType<EditorDemoProps>>();

  useEffect(() => {
    let mounted = true;

    void import('../src/react/Editor/demos/index').then(({ default: EditorDemo }) => {
      if (mounted) setEditor(() => EditorDemo);
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!Editor) return <div aria-busy="true" style={{ minHeight: 420 }} />;

  return <Editor collapsible defaultActiveKey={['editor']} />;
};

const items: FeaturesProps['items'] = [
  {
    description:
      "Built on Meta's robust Lexical framework for reliable rich text editing with powerful features.",
    icon: Zap,
    title: 'Lexical-Powered',
  },

  {
    description:
      'Extensible architecture with modular plugins for images, code blocks, links, lists, and more.',
    icon: Puzzle,
    title: 'Plugin System',
  },
  {
    description:
      'Quick content insertion with customizable slash menu for enhanced editing experience.',
    icon: Slash,
    title: 'Slash Commands',
  },
];

export default () => {
  return (
    <div className={styles.root}>
      <section aria-labelledby="home-hero-title" className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 id="home-hero-title">
            <span>LobeHub</span>
            <span className={styles.accent}>Editor</span>
          </h1>
          <p>{description}</p>
          <div className={styles.actions}>
            <a
              className={`${styles.action} ${styles.primaryAction}`}
              href="https://github.com/lobehub/lobe-editor"
              rel="noreferrer"
              target="_blank"
            >
              <Github aria-hidden size={18} strokeWidth={1.8} />
              GitHub
            </a>
            <a className={styles.action} href="/components/react/editor">
              Get Started
            </a>
          </div>
        </div>
      </section>

      <Center
        className={styles.content}
        gap={48}
        style={{ maxWidth: 960, overflow: 'hidden', position: 'relative' }}
      >
        <Block variant={'outlined'} width={'100%'}>
          <EditorPreview />
        </Block>
        <Features items={items} />
      </Center>
    </div>
  );
};
