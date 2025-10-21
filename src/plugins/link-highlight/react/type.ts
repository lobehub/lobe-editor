export interface ReactLinkHighlightPluginProps {
  className?: string;
  /**
   * Enable keyboard shortcut (Ctrl+K / Cmd+K)
   * @default true
   */
  enableHotkey?: boolean;
  /**
   * Enable auto-highlight when pasting URLs
   * @default true
   */
  enablePasteAutoHighlight?: boolean;
}
