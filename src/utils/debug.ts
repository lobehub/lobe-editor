// @ts-ignore - debug package types
import createDebug from 'debug';

/**
 * Base namespace for all LobeHub Editor debug messages
 */
const BASE_NAMESPACE = 'lobe-editor';

/**
 * Debug utility factory for LobeHub Editor
 * Creates namespaced debug functions following the pattern: lobe-editor:category
 */
export class DebugLogger {
  private debuggers = new Map<string, createDebug.Debugger>();

  /**
   * Get or create a debug function for a specific namespace
   * @param category - The debug category (e.g., 'kernel', 'plugin', 'upload')
   * @param subcategory - Optional subcategory for more specific debugging
   * @returns Debug function
   */
  public getDebugger(category: string, subcategory?: string): createDebug.Debugger {
    const namespace = subcategory
      ? `${BASE_NAMESPACE}:${category}:${subcategory}`
      : `${BASE_NAMESPACE}:${category}`;

    if (!this.debuggers.has(namespace)) {
      this.debuggers.set(namespace, createDebug(namespace));
    }

    return this.debuggers.get(namespace)!;
  }

  /**
   * Create a scoped debug logger for a specific component/service
   * @param category - Main category
   * @param subcategory - Optional subcategory
   * @returns Object with debug methods
   */
  public createLogger(category: string, subcategory?: string) {
    const debug = this.getDebugger(category, subcategory);
    const warnDebugger = this.getDebugger(category, subcategory ? `${subcategory}:warn` : 'warn');
    const errorDebugger = this.getDebugger(
      category,
      subcategory ? `${subcategory}:error` : 'error',
    );
    const info = this.getDebugger(category, subcategory ? `${subcategory}:info` : 'info');

    // Create wrapper functions that use native console methods for proper browser dev tool support
    const warn = (...args: any[]) => {
      if (warnDebugger.enabled) {
        const prefix = warnDebugger.namespace;
        console.warn(`${prefix}`, ...args);
      }
    };

    const error = (...args: any[]) => {
      if (errorDebugger.enabled) {
        const prefix = errorDebugger.namespace;
        console.error(`${prefix}`, ...args);
      }
    };

    return {
      /**
       * General debug logging
       */
      debug: debug,

      /**
       * Error level logging - uses console.error for proper browser dev tool support
       */
      error: error,

      /**
       * Info level logging
       */
      info: info,

      /**
       * Log function - alias for debug for compatibility
       */
      log: debug,

      /**
       * Warning level logging - uses console.warn for proper browser dev tool support
       */
      warn: warn,
    };
  }

  /**
   * Enable debug for specific namespaces
   * @param namespaces - Comma-separated list of namespaces to enable
   */
  public enable(namespaces: string): void {
    createDebug.enable(namespaces);
  }

  /**
   * Disable all debug output
   */
  public disable(): void {
    createDebug.disable();
  }

  /**
   * Check if a namespace is enabled
   * @param namespace - The namespace to check
   * @returns Whether the namespace is enabled
   */
  public enabled(namespace: string): boolean {
    return createDebug.enabled(namespace);
  }
}

/**
 * Global debug logger instance
 */
export const debugLogger = new DebugLogger();

/**
 * Convenience function to create a debug logger for a specific category
 * @param category - Main category (e.g., 'kernel', 'plugin', 'upload')
 * @param subcategory - Optional subcategory
 * @returns Logger object with debug methods
 */
export function createDebugLogger(category: string, subcategory?: string) {
  return debugLogger.createLogger(category, subcategory);
}

/**
 * Pre-configured debug loggers for common categories
 */
export const debugLoggers = {
  demo: createDebugLogger('demo'),
  file: createDebugLogger('file'),
  image: createDebugLogger('image'),
  kernel: createDebugLogger('kernel'),
  markdown: createDebugLogger('markdown'),
  math: createDebugLogger('math'),
  mention: createDebugLogger('mention'),
  plugin: createDebugLogger('plugin'),
  react: createDebugLogger('react'),
  service: createDebugLogger('service'),
  slash: createDebugLogger('slash'),
  upload: createDebugLogger('upload'),
};

/**
 * Development mode utilities
 */
export const isDev = process.env.NODE_ENV === 'development';

/**
 * Conditional console logging - only logs in development mode
 * Use this for demo files and development-only logging
 */
export const devConsole = {
  error: (...args: any[]) => {
    if (isDev) {
      console.error(...args);
    }
  },
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args);
    }
  },
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
};

/**
 * Production-safe error logging
 * Always logs errors and warnings regardless of environment using native console methods
 * for proper browser dev tool support. Debug/info uses debug package.
 */
export const prodSafeLogger = {
  /**
   * Debug info - only shown when debug is enabled
   */
  debug: debugLoggers.kernel.debug,

  /**
   * Log critical errors that should always be visible (uses console.error)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Info logging - only shown when debug is enabled
   */
  info: debugLoggers.kernel.info,

  /**
   * Log warnings that should always be visible (uses console.warn)
   */
  warn: (...args: any[]) => {
    console.warn(...args);
  },
};
