import { defineConfig } from 'dumi';
import { SiteThemeConfig } from 'dumi-theme-lobehub';
import { INavItem } from 'dumi/dist/client/theme-api/types';
import { resolve } from 'node:path';

import { description, homepage, name } from './package.json';

const isProduction = process.env.NODE_ENV === 'production';
const isWin = process.platform === 'win32';

export const packages = ['react', 'plugins'];

const nav: INavItem[] = [
  { link: '/components/react/editor', title: 'Components' },
  { link: '/components/plugins/common', title: 'Plugins' },
  { link: 'https://ui.lobehub.com', mode: 'override', title: 'UI' },
  { link: 'https://icon.lobehub.com', mode: 'override', title: 'Icons' },
  { link: '/changelog', title: 'Changelog' },
];

const themeConfig: SiteThemeConfig = {
  actions: [
    {
      github: true,
      link: homepage,
      openExternal: true,
      text: 'GitHub',
    },
    {
      link: '/components/react/editor',
      text: 'Get Started',
      type: 'primary',
    },
  ],
  analytics: {
    plausible: {
      domain: 'editor.lobehub.com',
      scriptBaseUrl: 'https://plausible.lobehub-inc.cn',
    },
  },
  apiHeader: {
    docUrl: `{github}/tree/master/src/{atomId}/index.md`,
    match: ['/components'],
    pkg: name,
    sourceUrl: `{github}/tree/master/src/{atomId}/index.tsx`,
  },
  description,
  giscus: {
    category: 'Q&A',
    categoryId: 'DIC_kwDOPM7uEc4CuTKC',
    repo: 'lobehub/lobe-editor',
    repoId: 'R_kgDOPM7uEQ',
  },
  lastUpdated: true,
  metadata: {
    openGraph: {
      image:
        'https://repository-images.githubusercontent.com/1020194321/a13f7ca8-0d9b-4ac0-a6c3-3932f39e42bd',
    },
  },
  name: 'Editor',
  nav,
  prefersColor: {
    default: 'dark',
    switch: false,
  },
  socialLinks: {
    discord: 'https://discord.gg/AYFPHvv2jT',
    github: homepage,
  },
  title: 'Lobe Editor',
};

const alias: Record<string, string> = {};
for (const pkg of packages) alias[`@lobehub/editor/${pkg}`] = resolve(__dirname, `./src/${pkg}`);
// 覆盖原始 lexical 框架
alias['lexical'] = resolve(__dirname, './src/editor-kernel/override/index');

export default defineConfig({
  alias,
  apiParser: isProduction ? {} : false,
  base: '/',
  define: {
    'process.env': process.env,
  },
  exportStatic: {},
  extraBabelPlugins: ['babel-plugin-antd-style'],
  favicons: ['https://lobehub.com/favicon.ico'],
  jsMinifier: 'swc',
  locales: [{ id: 'en-US', name: 'English' }],
  mfsu: isWin ? undefined : {},
  npmClient: 'pnpm',
  publicPath: '/',
  resolve: {
    atomDirs: packages.map((pkg) => ({ dir: `src/${pkg}`, subType: pkg, type: 'component' })),
    entryFile: isProduction ? './src/index.ts' : undefined,
  },
  sitemap: {
    hostname: 'https://editor.lobehub.com',
  },
  ssr: isProduction ? {} : false,
  styles: [
    `html, body { background: transparent;  }

  @media (prefers-color-scheme: dark) {
    html, body { background: #000; }
  }`,
  ],
  themeConfig,
  title: 'Lobe Editor',
});
