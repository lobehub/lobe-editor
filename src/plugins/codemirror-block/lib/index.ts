import { createDebugLogger } from '@/utils/debug';

const logger = createDebugLogger('plugin', 'codemirror-loader');

// CDN URL 配置
const DEFAULT_CDN_URL =
  'https://registry.npmmirror.com/@lobehub/codemirror/1.0.0/files/es/index.js';
const LOAD_TIMEOUT = 10_000; // 10 秒超时
const POLL_INTERVAL = 50; // 50ms 轮询间隔

export const AllLang = [];

export interface Options {
  className?: string;
  foldGutter?: boolean;
  history?: any;
  indentWithTabs?: boolean;
  lineNumbers?: boolean;
  lineWrapping?: boolean;
  mode?: string;
  preventCopy?: boolean;
  readOnly?: boolean;
  tabSize?: number;
  theme?: 'default';
  value?: string;
}

export interface ICodeMirrorInstance {
  blur(): void;
  clearHistory(): void;
  destroy(): void;
  focus(): void;
  foldGutter?: boolean;
  foldLines(): number[];
  foldLines(lines: number[]): void;
  formatAll(): void;
  getHistory(): any;
  getLine(line: number): string;
  getSelection(): string;
  getValue: () => string;
  historyRedoDepth(): number;
  historyUndoDepth(): number;
  lineCount(): number;
  on(
    event:
      | 'change'
      | 'blur'
      | 'focus'
      | 'keyup'
      | 'fold'
      | 'unfold'
      | 'keydown'
      | 'rightOut'
      | 'leftOut',
    handler: (...args: any[]) => void,
  ): void;
  optionHelper: {
    theme: {
      reconfigure: (theme: any) => void;
    };
  };
  redoSelection(): void;
  replaceSelection(text: string): void;
  setOption(option: keyof Options, value: any): void;
  setSelection(anchor: number, header: number): void;
  setSelectionToEnd(): void;
  setSelectionToStart(): void;
  setValue(value: string): void;
  undoSelection(): void;
  view: {
    constructor: {
      theme: (options: any, settings: any) => any;
    };
    dispatch: (params: { effects: any }) => void;
  };
}

export interface ICodeMirror {
  fromTextArea: (textarea: HTMLTextAreaElement, options?: Options) => ICodeMirrorInstance;
  new (dom: HTMLElement, options?: Options): ICodeMirrorInstance;
}

// 使用 Promise 缓存避免并发重复加载
let codeMirrorPromise: Promise<ICodeMirror> | null = null;

/**
 * 加载 script 标签
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // 检查是否已经加载过相同的脚本
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
      logger.debug('Script already loaded:', src);
      resolve();
      return;
    }

    logger.debug('Loading script:', src);
    const script = document.createElement('script');
    script.src = src;
    script.type = 'module';
    script.async = true;
    script.addEventListener('load', () => {
      logger.debug('Script loaded successfully:', src);
      resolve();
    });
    script.addEventListener('error', (error) => {
      logger.error('Failed to load script:', src, error);
      reject(new Error(`Failed to load script: ${src}`));
    });
    document.head.append(script);
  });
}

/**
 * 等待 window.CodeMirror 可用
 */
function waitForCodeMirror(timeout: number = LOAD_TIMEOUT): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkCodeMirror = () => {
      // @ts-expect-error not error
      if (window.CodeMirror) {
        logger.debug('CodeMirror is ready');
        resolve();
        return;
      }

      if (Date.now() - startTime > timeout) {
        logger.error('Timeout waiting for CodeMirror');
        reject(new Error('Timeout: CodeMirror failed to load from CDN'));
        return;
      }

      setTimeout(checkCodeMirror, POLL_INTERVAL);
    };

    checkCodeMirror();
  });
}

/**
 * 从 CDN 加载 CodeMirror
 * @param cdnUrl - 可选的自定义 CDN URL
 */
export async function loadCodeMirror(cdnUrl: string = DEFAULT_CDN_URL): Promise<ICodeMirror> {
  // 如果已经加载，直接返回
  // @ts-expect-error not error
  if (window.CodeMirror?.default) {
    logger.debug('CodeMirror already available');
    // @ts-expect-error not error
    return window.CodeMirror.default as ICodeMirror;
  }

  // 如果正在加载，返回缓存的 Promise
  if (codeMirrorPromise) {
    logger.debug('CodeMirror loading in progress, reusing promise');
    return codeMirrorPromise;
  }

  // 创建新的加载 Promise
  codeMirrorPromise = (async () => {
    try {
      logger.debug('Starting CodeMirror load from:', cdnUrl);
      await loadScript(cdnUrl);
      await waitForCodeMirror();

      // @ts-expect-error not error
      if (!window.CodeMirror?.default) {
        throw new Error('CodeMirror loaded but not properly initialized');
      }

      logger.debug('CodeMirror loaded successfully');
      // @ts-expect-error not error
      return window.CodeMirror.default as ICodeMirror;
    } catch (error) {
      // 加载失败时清除缓存，允许重试
      codeMirrorPromise = null;
      logger.error('Failed to load CodeMirror:', error);
      throw error;
    }
  })();

  return codeMirrorPromise;
}
