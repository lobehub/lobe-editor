export const MODES = [
  { ext: ['agda'], name: 'Agda', syntax: 'text/x-agda', value: 'agda' },
  {
    ext: ['ets', 'arkts'],
    name: 'ArkTS',
    syntax: 'text/x-arkts',
    value: 'arkts',
  },
  { ext: ['bash'], name: 'Bash', syntax: 'shell', value: 'bash' },
  { ext: ['vbs'], name: 'Basic', syntax: 'vbscript', value: 'basic' },
  { ext: ['c', 'h', 'ino'], name: 'C', syntax: 'text/x-csrc', value: 'c' },
  {
    ext: ['cpp', 'c++', 'cc', 'cxx', 'hpp', 'h++', 'hh', 'hxx'],
    name: 'C++',
    syntax: 'text/x-c++src',
    value: 'cpp',
  },
  { ext: ['cs'], name: 'C#', syntax: 'text/x-csharp', value: 'csharp' },
  { ext: ['css'], name: 'CSS', syntax: 'css', value: 'css' },
  { ext: ['dart'], name: 'Dart', syntax: 'dart', value: 'dart' },
  { ext: ['diff', 'patch'], name: 'Diff', syntax: 'diff', value: 'diff' },
  { name: 'Dockerfile', syntax: 'dockerfile', value: 'dockerfile' },
  { ext: ['erl'], name: 'Erlang', syntax: 'erlang', value: 'erlang' },
  { ext: ['glsl'], name: 'Glsl', syntax: 'x-shader/x-vertex', value: 'glsl' },
  { name: 'Git', syntax: 'shell', value: 'git' },
  { ext: ['go'], name: 'Go', syntax: 'go', value: 'go' },
  { name: 'GraphQL', syntax: 'graphql', value: 'graphql' },
  {
    ext: ['groovy', 'gradle'],
    name: 'Groovy',
    syntax: 'groovy',
    value: 'groovy',
  },
  {
    ext: ['html', 'htm', 'handlebars', 'hbs'],
    name: 'HTML',
    syntax: 'htmlmixed',
    value: 'html',
  },
  { name: 'HTTP', syntax: 'http', value: 'http' },
  { ext: ['java'], name: 'Java', syntax: 'text/x-java', value: 'java' },
  {
    ext: ['js'],
    name: 'JavaScript',
    syntax: 'text/javascript',
    value: 'javascript',
  },
  {
    ext: ['json', 'map'],
    name: 'JSON',
    syntax: 'application/json',
    value: 'json',
  },
  { ext: ['jsx'], name: 'JSX', syntax: 'jsx', value: 'jsx' },
  { name: 'KaTeX', syntax: 'simplemode', value: 'katex' },
  { ext: ['kt'], name: 'Kotlin', syntax: 'text/x-kotlin', value: 'kotlin' },
  { ext: ['less'], name: 'Less', syntax: 'css', value: 'less' },
  { name: 'Makefile', syntax: 'cmake', value: 'makefile' },
  {
    ext: ['markdown', 'md', 'mkd'],
    name: 'Markdown',
    syntax: 'markdown',
    value: 'markdown',
  },
  { name: 'MATLAB', syntax: 'octave', value: 'matlab' },
  { ext: ['conf'], name: 'Nginx', syntax: 'nginx', value: 'nginx' },
  {
    ext: ['m'],
    name: 'Objective-C',
    syntax: 'text/x-objectivec',
    value: 'objectivec',
  },
  { ext: ['p', 'pas'], name: 'Pascal', syntax: 'pascal', value: 'pascal' },
  { ext: ['pl', 'pm'], name: 'Perl', syntax: 'perl', value: 'perl' },

  // syntax 从 'php' 改为 'text/x-php'
  // 解决 php 必须带有 <?php 标签才会高亮的问题
  {
    ext: ['php', 'php3', 'php4', 'php5', 'php7', 'phtml'],
    name: 'PHP',
    syntax: 'text/x-php',
    value: 'php',
  },

  // { value: 'plantuml', syntax: 'plantuml', name: 'PlantUML' }, // 和文本图容易冲突，不再支持
  {
    ext: ['ps1', 'psd1', 'psm1'],
    name: 'PowerShell',
    syntax: 'powershell',
    value: 'powershell',
  },
  { ext: ['proto'], name: 'Protobuf', syntax: 'protobuf', value: 'protobuf' },
  {
    ext: ['build', 'bzl', 'py', 'pyw'],
    name: 'Python',
    syntax: 'python',
    value: 'python',
  },
  { ext: ['r', 'R'], name: 'R', syntax: 'r', value: 'r' },
  { ext: ['rb'], name: 'Ruby', syntax: 'ruby', value: 'ruby' },
  { ext: ['rs'], name: 'Rust', syntax: 'rust', value: 'rust' },
  { ext: ['scala'], name: 'Scala', syntax: 'text/x-scala', value: 'scala' },
  { ext: ['sh', 'ksh'], name: 'Shell', syntax: 'shell', value: 'shell' },
  { ext: ['sql'], name: 'SQL', syntax: 'text/x-sql', value: 'sql' },
  { name: 'PL/SQL', syntax: 'text/x-plsql', value: 'plsql' },
  { ext: ['swift'], name: 'Swift', syntax: 'swift', value: 'swift' },
  {
    ext: ['ts'],
    name: 'TypeScript',
    syntax: 'text/typescript',
    value: 'typescript',
  },
  { ext: ['vb'], name: 'VB.net', syntax: 'vb', value: 'vbnet' },
  { ext: ['vtl'], name: 'Velocity', syntax: 'velocity', value: 'velocity' },
  {
    ext: ['xml', 'xsl', 'xsd', 'svg'],
    name: 'XML',
    syntax: 'xml',
    value: 'xml',
  },
  { ext: ['yaml', 'yml'], name: 'YAML', syntax: 'yaml', value: 'yaml' },
  { name: 'sTeX', syntax: 'text/x-stex', value: 'stex' },
  {
    ext: ['text', 'ltx', 'tex'],
    name: 'LaTeX',
    syntax: 'text/x-latex',
    value: 'latex',
  },
  {
    ext: ['sv', 'svh'],
    name: 'SystemVerilog',
    syntax: 'text/x-systemverilog',
    value: 'systemverilog',
  },
  {
    ext: ['sass', 'scss'],
    name: 'Sass',
    syntax: 'text/x-sass',
    value: 'sass',
  },
  { ext: ['tcl'], name: 'Tcl', syntax: 'text/x-tcl', value: 'tcl' },
  { ext: ['v'], name: 'Verilog', syntax: 'text/x-verilog', value: 'verilog' },
  { name: 'Vue', syntax: 'text/x-vue', value: 'vue' },
  { ext: ['lua'], name: 'Lua', syntax: 'text/x-lua', value: 'lua' },
  { ext: ['hs'], name: 'Haskell', syntax: 'haskell', value: 'haskell' },
  {
    ext: ['properties', 'ini', 'in'],
    name: 'Properties',
    syntax: 'properties',
    value: 'properties',
  },
  { ext: ['toml'], name: 'TOML', syntax: 'toml', value: 'toml' },
  { ext: ['cyp', 'cypher'], name: 'Cypher', syntax: 'cypher', value: 'cypher' },
  { ext: ['tsx'], name: 'TSX', syntax: 'jsx', value: 'tsx' },
  { ext: ['fs'], name: 'F#', syntax: 'mllike', value: 'f#' },
  {
    ext: ['ml', 'mli', 'mll', 'mly'],
    name: 'OCaml',
    syntax: 'mllike',
    value: 'ocaml',
  },
  {
    ext: ['clj', 'cljc', 'cljx'],
    name: 'Clojure',
    syntax: 'clojure',
    value: 'clojure',
  },
  { name: 'ABAP', syntax: 'abap', value: 'abap' },
  { ext: ['jl'], name: 'Julia', syntax: 'julia', value: 'julia' },
  { ext: ['cmake'], name: 'CMake', syntax: 'cmake', value: 'cmake' },
  { ext: ['scm', 'ss'], name: 'Scheme', syntax: 'scheme', value: 'scheme' },
  {
    ext: ['cl', 'lisp', 'el'],
    name: 'Lisp',
    syntax: 'commonlisp',
    value: 'commonlisp',
  },
  {
    ext: ['f90', 'f95', 'f03'],
    name: 'Fortran',
    syntax: 'fortran',
    value: 'fortran',
  },
  {
    ext: ['sol'],
    name: 'Solidity',
    syntax: 'solidity',
    value: 'solidity',
  },
];

// 不支持格式化的语言
export const DISABLE_FORMAT_MODE = ['yaml'];

MODES.sort((modeA, modeB) => {
  const nameA = modeA.name.toLowerCase();
  const nameB = modeB.name.toLowerCase();

  if (nameA === nameB) {
    return 0;
  }

  if (nameA < nameB) {
    return -1;
  }

  return 1;
});

// 保证 plain text 是第一个
MODES.unshift({ name: 'Plain Text', syntax: 'simplemode', value: 'plain' });

export function modeMatch(mode = '') {
  // eslint-disable-next-line no-param-reassign
  mode = mode.toLocaleLowerCase() || 'plain';
  const findMode = MODES.find((m) => m.value === mode || m.ext?.includes(mode));

  return findMode?.value || 'plain';
}

export const DEFAULT_THEME = 'default';
export const DEFAULT_DARDK_THEME = 'dark-default';
export const DARCULAR_THEME = 'Darcula';
export const NIGHT_OWL_THEME = 'Night Owl';
export const ONE_DARK_PRO_THEME = 'One Dark Pro';
export const GITHUB_THEME = 'Github Light';
export const BRACKET_LIGHTS_PRO_THEME = 'Bracket Lights Pro';

export enum CODE_THEME_ENUM {
  BRACKET_LIGHTS_PRO = 'Bracket Lights Pro',
  DARCULAR = 'Darcula',
  DEFAULT = 'default',
  DEFAULT_DARDK = 'dark-default',
  GITHUB = 'Github Light',
  NIGHT_OWL = 'Night Owl',
  ONE_DARK_PRO = 'One Dark Pro',
}

export const THEMES = [
  {
    isDark: false,
    name: 'Yuque Light Pro',
    value: CODE_THEME_ENUM.GITHUB, // 是否是深色主题
  },
  {
    isDark: false,
    name: 'Yuque Light',
    value: CODE_THEME_ENUM.DEFAULT,
  },
  {
    isDark: false,
    name: CODE_THEME_ENUM.BRACKET_LIGHTS_PRO,
    value: CODE_THEME_ENUM.BRACKET_LIGHTS_PRO,
  },
  {
    isDark: true,
    name: CODE_THEME_ENUM.ONE_DARK_PRO,
    value: CODE_THEME_ENUM.ONE_DARK_PRO,
  },
  {
    isDark: true,
    name: CODE_THEME_ENUM.NIGHT_OWL,
    value: CODE_THEME_ENUM.NIGHT_OWL,
  },
  {
    isDark: true,
    name: CODE_THEME_ENUM.DARCULAR,
    value: CODE_THEME_ENUM.DARCULAR,
  },
];

// 默认主题下 codeblock 首选风格名
export const DEFAULT_CODEBLOCK_THEME_NAME = CODE_THEME_ENUM.DEFAULT;

// dark主题下 codeblock 首选风格名
export const DARK_CODEBLOCK_THEME_NAME = CODE_THEME_ENUM.DARCULAR;

export function getValidTheme(theme: string, isDark?: boolean) {
  const find = THEMES.find((v) => v.value === theme || v.name === theme);
  if (find) {
    return find.value;
  }
  return isDark ? DARK_CODEBLOCK_THEME_NAME : DEFAULT_CODEBLOCK_THEME_NAME;
}
