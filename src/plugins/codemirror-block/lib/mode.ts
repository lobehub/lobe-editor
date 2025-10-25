export const MODES = [
    { value: 'agda', syntax: 'text/x-agda', name: 'Agda', ext: ['agda'] },
    {
        value: 'arkts',
        syntax: 'text/x-arkts',
        name: 'ArkTS',
        ext: ['ets', 'arkts'],
    },
    { value: 'bash', syntax: 'shell', name: 'Bash', ext: ['bash'] },
    { value: 'basic', syntax: 'vbscript', name: 'Basic', ext: ['vbs'] },
    { value: 'c', syntax: 'text/x-csrc', name: 'C', ext: ['c', 'h', 'ino'] },
    {
        value: 'cpp',
        syntax: 'text/x-c++src',
        name: 'C++',
        ext: ['cpp', 'c++', 'cc', 'cxx', 'hpp', 'h++', 'hh', 'hxx'],
    },
    { value: 'csharp', syntax: 'text/x-csharp', name: 'C#', ext: ['cs'] },
    { value: 'css', syntax: 'css', name: 'CSS', ext: ['css'] },
    { value: 'dart', syntax: 'dart', name: 'Dart', ext: ['dart'] },
    { value: 'diff', syntax: 'diff', name: 'Diff', ext: ['diff', 'patch'] },
    { value: 'dockerfile', syntax: 'dockerfile', name: 'Dockerfile' },
    { value: 'erlang', syntax: 'erlang', name: 'Erlang', ext: ['erl'] },
    { value: 'glsl', syntax: 'x-shader/x-vertex', name: 'Glsl', ext: ['glsl'] },
    { value: 'git', syntax: 'shell', name: 'Git' },
    { value: 'go', syntax: 'go', name: 'Go', ext: ['go'] },
    { value: 'graphql', syntax: 'graphql', name: 'GraphQL' },
    {
        value: 'groovy',
        syntax: 'groovy',
        name: 'Groovy',
        ext: ['groovy', 'gradle'],
    },
    {
        value: 'html',
        syntax: 'htmlmixed',
        name: 'HTML',
        ext: ['html', 'htm', 'handlebars', 'hbs'],
    },
    { value: 'http', syntax: 'http', name: 'HTTP' },
    { value: 'java', syntax: 'text/x-java', name: 'Java', ext: ['java'] },
    {
        value: 'javascript',
        syntax: 'text/javascript',
        name: 'JavaScript',
        ext: ['js'],
    },
    {
        value: 'json',
        syntax: 'application/json',
        name: 'JSON',
        ext: ['json', 'map'],
    },
    { value: 'jsx', syntax: 'jsx', name: 'JSX', ext: ['jsx'] },
    { value: 'katex', syntax: 'simplemode', name: 'KaTeX' },
    { value: 'kotlin', syntax: 'text/x-kotlin', name: 'Kotlin', ext: ['kt'] },
    { value: 'less', syntax: 'css', name: 'Less', ext: ['less'] },
    { value: 'makefile', syntax: 'cmake', name: 'Makefile' },
    {
        value: 'markdown',
        syntax: 'markdown',
        name: 'Markdown',
        ext: ['markdown', 'md', 'mkd'],
    },
    { value: 'matlab', syntax: 'octave', name: 'MATLAB' },
    { value: 'nginx', syntax: 'nginx', name: 'Nginx', ext: ['conf'] },
    {
        value: 'objectivec',
        syntax: 'text/x-objectivec',
        name: 'Objective-C',
        ext: ['m'],
    },
    { value: 'pascal', syntax: 'pascal', name: 'Pascal', ext: ['p', 'pas'] },
    { value: 'perl', syntax: 'perl', name: 'Perl', ext: ['pl', 'pm'] },

    // syntax 从 'php' 改为 'text/x-php'
    // 解决 php 必须带有 <?php 标签才会高亮的问题
    {
        value: 'php',
        syntax: 'text/x-php',
        name: 'PHP',
        ext: ['php', 'php3', 'php4', 'php5', 'php7', 'phtml'],
    },

    // { value: 'plantuml', syntax: 'plantuml', name: 'PlantUML' }, // 和文本图容易冲突，不再支持
    {
        value: 'powershell',
        syntax: 'powershell',
        name: 'PowerShell',
        ext: ['ps1', 'psd1', 'psm1'],
    },
    { value: 'protobuf', syntax: 'protobuf', name: 'Protobuf', ext: ['proto'] },
    {
        value: 'python',
        syntax: 'python',
        name: 'Python',
        ext: ['build', 'bzl', 'py', 'pyw'],
    },
    { value: 'r', syntax: 'r', name: 'R', ext: ['r', 'R'] },
    { value: 'ruby', syntax: 'ruby', name: 'Ruby', ext: ['rb'] },
    { value: 'rust', syntax: 'rust', name: 'Rust', ext: ['rs'] },
    { value: 'scala', syntax: 'text/x-scala', name: 'Scala', ext: ['scala'] },
    { value: 'shell', syntax: 'shell', name: 'Shell', ext: ['sh', 'ksh'] },
    { value: 'sql', syntax: 'text/x-sql', name: 'SQL', ext: ['sql'] },
    { value: 'plsql', syntax: 'text/x-plsql', name: 'PL/SQL' },
    { value: 'swift', syntax: 'swift', name: 'Swift', ext: ['swift'] },
    {
        value: 'typescript',
        syntax: 'text/typescript',
        name: 'TypeScript',
        ext: ['ts'],
    },
    { value: 'vbnet', syntax: 'vb', name: 'VB.net', ext: ['vb'] },
    { value: 'velocity', syntax: 'velocity', name: 'Velocity', ext: ['vtl'] },
    {
        value: 'xml',
        syntax: 'xml',
        name: 'XML',
        ext: ['xml', 'xsl', 'xsd', 'svg'],
    },
    { value: 'yaml', syntax: 'yaml', name: 'YAML', ext: ['yaml', 'yml'] },
    { value: 'stex', syntax: 'text/x-stex', name: 'sTeX' },
    {
        value: 'latex',
        syntax: 'text/x-latex',
        name: 'LaTeX',
        ext: ['text', 'ltx', 'tex'],
    },
    {
        value: 'systemverilog',
        syntax: 'text/x-systemverilog',
        name: 'SystemVerilog',
        ext: ['sv', 'svh'],
    },
    {
        value: 'sass',
        name: 'Sass',
        syntax: 'text/x-sass',
        ext: ['sass', 'scss'],
    },
    { value: 'tcl', syntax: 'text/x-tcl', name: 'Tcl', ext: ['tcl'] },
    { value: 'verilog', syntax: 'text/x-verilog', name: 'Verilog', ext: ['v'] },
    { value: 'vue', syntax: 'text/x-vue', name: 'Vue' },
    { value: 'lua', syntax: 'text/x-lua', name: 'Lua', ext: ['lua'] },
    { value: 'haskell', syntax: 'haskell', name: 'Haskell', ext: ['hs'] },
    {
        value: 'properties',
        syntax: 'properties',
        name: 'Properties',
        ext: ['properties', 'ini', 'in'],
    },
    { value: 'toml', syntax: 'toml', name: 'TOML', ext: ['toml'] },
    { value: 'cypher', syntax: 'cypher', name: 'Cypher', ext: ['cyp', 'cypher'] },
    { value: 'tsx', syntax: 'jsx', name: 'TSX', ext: ['tsx'] },
    { value: 'f#', syntax: 'mllike', name: 'F#', ext: ['fs'] },
    {
        value: 'ocaml',
        syntax: 'mllike',
        name: 'OCaml',
        ext: ['ml', 'mli', 'mll', 'mly'],
    },
    {
        value: 'clojure',
        syntax: 'clojure',
        name: 'Clojure',
        ext: ['clj', 'cljc', 'cljx'],
    },
    { value: 'abap', syntax: 'abap', name: 'ABAP' },
    { value: 'julia', syntax: 'julia', name: 'Julia', ext: ['jl'] },
    { value: 'cmake', syntax: 'cmake', name: 'CMake', ext: ['cmake'] },
    { value: 'scheme', syntax: 'scheme', name: 'Scheme', ext: ['scm', 'ss'] },
    {
        value: 'commonlisp',
        syntax: 'commonlisp',
        name: 'Lisp',
        ext: ['cl', 'lisp', 'el'],
    },
    {
        value: 'fortran',
        syntax: 'fortran',
        name: 'Fortran',
        ext: ['f90', 'f95', 'f03'],
    },
    {
        value: 'solidity',
        syntax: 'solidity',
        name: 'Solidity',
        ext: ['sol'],
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
MODES.unshift({ value: 'plain', syntax: 'simplemode', name: 'Plain Text' });

export function modeMatch(mode = '') {
    mode = mode.toLocaleLowerCase() || 'plain';
    const findMode = MODES.find(m => m.value === mode || m.ext?.includes(mode));

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
    DEFAULT = 'default',
    DEFAULT_DARDK = 'dark-default',
    DARCULAR = 'Darcula',
    NIGHT_OWL = 'Night Owl',
    ONE_DARK_PRO = 'One Dark Pro',
    GITHUB = 'Github Light',
    BRACKET_LIGHTS_PRO = 'Bracket Lights Pro',
}

export const THEMES = [
    {
        name: 'Yuque Light Pro',
        value: CODE_THEME_ENUM.GITHUB,
        isDark: false, // 是否是深色主题
    },
    {
        name: 'Yuque Light',
        value: CODE_THEME_ENUM.DEFAULT,
        isDark: false,
    },
    {
        name: CODE_THEME_ENUM.BRACKET_LIGHTS_PRO,
        value: CODE_THEME_ENUM.BRACKET_LIGHTS_PRO,
        isDark: false,
    },
    {
        name: CODE_THEME_ENUM.ONE_DARK_PRO,
        value: CODE_THEME_ENUM.ONE_DARK_PRO,
        isDark: true,
    },
    {
        name: CODE_THEME_ENUM.NIGHT_OWL,
        value: CODE_THEME_ENUM.NIGHT_OWL,
        isDark: true,
    },
    {
        name: CODE_THEME_ENUM.DARCULAR,
        value: CODE_THEME_ENUM.DARCULAR,
        isDark: true,
    },
];

// 默认主题下 codeblock 首选风格名
export const DEFAULT_CODEBLOCK_THEME_NAME = CODE_THEME_ENUM.DEFAULT;

// dark主题下 codeblock 首选风格名
export const DARK_CODEBLOCK_THEME_NAME = CODE_THEME_ENUM.DARCULAR;

export function getValidTheme(theme: string, isDark?: boolean) {
    const find = THEMES.find(v => v.value === theme || v.name === theme);
    if (find) {
        return find.value;
    }
    return isDark ? DARK_CODEBLOCK_THEME_NAME : DEFAULT_CODEBLOCK_THEME_NAME;
}
