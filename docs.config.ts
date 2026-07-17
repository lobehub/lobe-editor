import { defineDocsConfig } from '@lobehub/docs-kit/src/config';
import type { DocumentationInventory } from '@lobehub/docs-kit/src/types';

import compatibility from './compatibility.json';

const legacyRedirects = compatibility as DocumentationInventory;

export default defineDocsConfig({
  alias: {
    '@': 'src',
    '@lobehub/editor': 'src',
  },
  atomDirs: [
    { dir: 'src/react', subType: 'react', type: 'component' },
    { dir: 'src/plugins', subType: 'plugins', type: 'component' },
    { dir: 'src/renderer', subType: 'renderer', type: 'component' },
  ],
  description:
    "A powerful and extensible rich text editor built on Meta's Lexical framework, providing a modern editing experience with React integration.",
  favicons: {
    icon: 'https://lobehub.com/favicon.ico',
  },
  homePage: './docs/index.tsx',
  legacyRedirects,
  navSections: {},
  publicDocs: ['docs/components.mdx'],
  siteUrl: 'https://editor.lobehub.com',
  themeConfig: {
    analytics: {
      plausible: {
        domain: 'editor.lobehub.com',
        source: 'https://plausible.lobehub-inc.cn/js/script.js',
      },
    },
    apiHeader: {
      docUrl: '{github}/edit/master/{atomId}',
      github: 'https://github.com/lobehub/lobe-editor',
      match: ['/components/'],
      packageName: '@lobehub/editor',
      packageNames: {
        plugins: '@lobehub/editor',
        react: '@lobehub/editor/react',
        renderer: '@lobehub/editor/renderer',
      },
      sourceUrl: '{github}/tree/master/{atomId}',
    },
    giscus: {
      category: 'Q&A',
      categoryId: 'DIC_kwDOPM7uEc4CuTKC',
      repo: 'lobehub/lobe-editor',
      repoId: 'R_kgDOPM7uEQ',
    },
    metadata: {
      openGraph: {
        image:
          'https://repository-images.githubusercontent.com/1020194321/a13f7ca8-0d9b-4ac0-a6c3-3932f39e42bd',
      },
    },
    navItems: [
      { external: true, href: 'https://ui.lobehub.com', label: 'UI' },
      { external: true, href: 'https://icon.lobehub.com', label: 'Icons' },
      { href: '/changelog', label: 'Changelog' },
    ],
    prefersColor: 'dark',
    socialLinks: [
      {
        href: 'https://github.com/lobehub/lobe-editor',
        icon: 'github',
        label: 'GitHub',
      },
      { href: 'https://discord.gg/AYFPHvv2jT', icon: 'discord', label: 'Discord' },
      {
        href: 'https://www.npmjs.com/package/@lobehub/editor',
        icon: 'npm',
        label: 'NPM',
      },
    ],
  },
  title: 'Lobe Editor',
});
