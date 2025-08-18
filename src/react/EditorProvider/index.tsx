import { ReactNode, createContext, use, useMemo } from 'react';

type LocaleType = typeof import('@/locale').default;

export interface EditorProviderConfig {
  [key: string]: any;
  locale?: Partial<LocaleType>;
  theme?: Record<string, any>;
}

interface EditorContextValue {
  config: EditorProviderConfig;
}

const EditorContext = createContext<EditorContextValue>({
  config: {},
});

export interface EditorProviderProps {
  children: ReactNode;
  config?: EditorProviderConfig;
}

export const EditorProvider = ({ children, config = {} }: EditorProviderProps) => {
  const value = useMemo<EditorContextValue>(
    () => ({
      config,
    }),
    [config],
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
};

export const useEditorContent = (): EditorContextValue => {
  return use(EditorContext);
};

EditorProvider.displayName = 'EditorProvider';
