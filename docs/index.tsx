import { ChatInput, CodeLanguageSelect, Editor } from '@lobehub/editor/react';
import { Block } from '@lobehub/ui';
import {
  AgentSkillCard,
  CodeShowcase,
  FeatureGrid,
  InstallBanner,
  LandingHero,
  type LandingLinkRender,
  LandingSection,
} from '@lobehub/ui/awesome';
import { GithubIcon } from '@lobehub/ui/icons';
import {
  ArrowRight,
  AtSign,
  FileText,
  MessageSquare,
  Slash,
  SquareCode,
  Table2,
} from 'lucide-react';
import { type ComponentType, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

const siteUrl = 'https://editor.lobehub.com';

const renderLink: LandingLinkRender = ({ external, href, ...props }) =>
  external ? (
    <a href={href} rel="noreferrer" target="_blank" {...props} />
  ) : (
    <Link to={href} {...props} />
  );

interface EditorDemoProps {
  collapsible?: boolean;
  defaultActiveKey?: string[];
}

const EditorPreview = () => {
  const [EditorDemo, setEditorDemo] = useState<ComponentType<EditorDemoProps>>();

  useEffect(() => {
    let mounted = true;

    void import('../src/react/Editor/demos/index').then(({ default: Demo }) => {
      if (mounted) setEditorDemo(() => Demo);
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!EditorDemo) return <div aria-busy="true" style={{ minHeight: 420 }} />;

  return <EditorDemo collapsible defaultActiveKey={['editor']} />;
};

const editorSnippet = `import { Editor } from '@lobehub/editor/react';

export default () => (
  <Editor
    content={'# Notes\\n\\nWrite in **Markdown**.'}
    placeholder="Write in Markdown…"
    type="markdown"
  />
);`;

const chatSnippet = `import { ChatInput, Editor } from '@lobehub/editor/react';

export default () => (
  <ChatInput minHeight={120} resize={false} style={{ width: '100%' }}>
    <Editor content="Draft a reply." placeholder="Ask anything…" type="markdown" />
  </ChatInput>
);`;

const languageSnippet = `import { CodeLanguageSelect } from '@lobehub/editor/react';

export default () => <CodeLanguageSelect />;`;

interface HomePageProps {
  description: string;
  getStartedPathname: string;
}

export default function Home({ description, getStartedPathname }: HomePageProps) {
  const navigate = useNavigate();

  return (
    <>
      <LandingHero
        accent="Editor"
        actions={[
          {
            href: getStartedPathname,
            icon: ArrowRight,
            iconPlacement: 'end',
            label: 'Get Started',
            primary: true,
          },
          {
            href: 'https://github.com/lobehub/lobe-editor',
            icon: GithubIcon,
            label: 'GitHub',
          },
        ]}
        aside={
          <AgentSkillCard
            agent={{
              code: `Read ${siteUrl}/skills.md and follow it to add @lobehub/editor.`,
              description: 'Send this prompt to your agent to build with the editor',
            }}
            human={{
              code: 'npx skills add lobehub/lobe-editor',
              description: 'Install the Lobe Editor skills into your project',
            }}
            footer={
              <>
                <a href={`${siteUrl}/skills.md`} rel="noreferrer" target="_blank">
                  skills.md
                </a>
                <a href={`${siteUrl}/llms.txt`} rel="noreferrer" target="_blank">
                  llms.txt
                </a>
              </>
            }
          />
        }
        description={<span data-pagefind-meta="description">{description}</span>}
        onNavigate={navigate}
        renderLink={renderLink}
        title={<span data-pagefind-meta="title">Lobe</span>}
      />

      <LandingSection
        actions={[{ href: '/components/react/editor', label: 'Editor docs' }]}
        description="Type into the editor, open the slash menu, and read the markdown back out."
        eyebrow="Playground"
        eyebrowColor="purple"
        id="home-editor"
        onNavigate={navigate}
        title="Write in the browser"
      >
        <Block style={{ overflow: 'hidden' }} variant="outlined" width="100%">
          <EditorPreview />
        </Block>
      </LandingSection>

      <LandingSection
        description="Mount an editor, a chat composer, or a language select."
        eyebrow="Usage"
        eyebrowColor="green"
        id="home-usage"
        title="A few lines to start"
      >
        <CodeShowcase
          items={[
            {
              code: editorSnippet,
              key: 'editor',
              label: 'Editor',
              preview: (
                <Editor
                  content={'# Notes\n\nWrite in **Markdown**.'}
                  placeholder="Write in Markdown…"
                  style={{ width: '100%' }}
                  type="markdown"
                />
              ),
            },
            {
              code: chatSnippet,
              key: 'chat',
              label: 'Chat',
              preview: (
                <ChatInput minHeight={120} resize={false} style={{ width: '100%' }}>
                  <Editor content="Draft a reply." placeholder="Ask anything…" type="markdown" />
                </ChatInput>
              ),
            },
            {
              code: languageSnippet,
              key: 'language',
              label: 'Language',
              preview: <CodeLanguageSelect />,
            },
          ]}
          minHeight={220}
        />
      </LandingSection>

      <LandingSection
        description="Blocks for documents, and the pieces a chat composer is made of."
        eyebrow="Foundations"
        eyebrowColor="orange"
        id="home-foundations"
        title="Documents and chat"
      >
        <FeatureGrid
          items={[
            {
              description: 'Type bold, headings, and lists, then export the document as markdown.',
              href: '/components/plugins/markdown',
              icon: FileText,
              title: 'Markdown',
            },
            {
              description: 'Fence a block and highlight it in the language you pick.',
              href: '/components/plugins/codeblock',
              icon: SquareCode,
              title: 'Code blocks',
            },
            {
              description: 'Insert a table and edit its rows from the keyboard.',
              href: '/components/plugins/table',
              icon: Table2,
              title: 'Tables',
            },
            {
              description: 'Press slash to insert headings, lists, tables, and rules.',
              href: '/components/plugins/slash',
              icon: Slash,
              title: 'Slash menu',
            },
            {
              description: 'Suggest people or files when the caret is after an @.',
              href: '/components/plugins/mention',
              icon: AtSign,
              title: 'Mentions',
            },
            {
              description: 'Resize a message box and send it from the footer.',
              href: '/components/react/chat-input',
              icon: MessageSquare,
              title: 'Chat input',
            },
          ]}
          renderLink={renderLink}
        />
      </LandingSection>

      <InstallBanner
        command="pnpm add @lobehub/editor"
        footnote={
          <>
            Open source · MIT license · <Link to={getStartedPathname}>Get Started</Link>
          </>
        }
        title="Start building"
      />
    </>
  );
}
