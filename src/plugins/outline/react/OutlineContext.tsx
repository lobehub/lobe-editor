'use client';

import {
  type FC,
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export interface OutlineVisibilityValue {
  setVisible: (next: boolean) => void;
  toggle: () => void;
  /** When false, {@link OutlinePanel} renders nothing. */
  visible: boolean;
}

export interface OutlineControlledVisibilityProps {
  onVisibleChange?: (visible: boolean) => void;
  visible?: boolean;
}

const OutlineVisibilityContext = createContext<OutlineVisibilityValue | null>(null);

export interface OutlineProviderProps extends PropsWithChildren {
  /** Initial visibility when using uncontrolled mode. */
  defaultVisible?: boolean;
}

/** Supplies visibility state for {@link OutlineToolbar}, {@link useOutlineActionItem}, and {@link OutlinePanel}. */
export const OutlineProvider: FC<OutlineProviderProps> = ({ children, defaultVisible = true }) => {
  const [visible, setVisible] = useState(defaultVisible);
  const toggle = useCallback(() => setVisible((v) => !v), []);
  const value = useMemo(() => ({ setVisible, toggle, visible }), [toggle, visible]);

  return (
    <OutlineVisibilityContext.Provider value={value}>{children}</OutlineVisibilityContext.Provider>
  );
};

OutlineProvider.displayName = 'OutlineProvider';

/** @returns Context value when inside {@link OutlineProvider}, otherwise `null`. */
export function useOutlineVisibilityContext(): OutlineVisibilityValue | null {
  return useContext(OutlineVisibilityContext);
}

/**
 * Reads outline visibility inside {@link OutlineProvider}.
 * @throws When used outside of a provider.
 */
export function useOutlineVisibility(): OutlineVisibilityValue {
  const v = useOutlineVisibilityContext();
  if (!v) {
    throw new Error('useOutlineVisibility must be used within <OutlineProvider>.');
  }
  return v;
}

export type OutlineVisibilityToggleApi =
  | { ready: false }
  | { ready: true; toggle: () => void; visible: boolean };

/**
 * Resolves toggling from optional controlled props vs {@link OutlineProvider}.
 * Use inside {@link OutlineToolbar} / {@link useOutlineActionItem}.
 */
export function useOutlineVisibilityToggle(
  controlled?: OutlineControlledVisibilityProps,
): OutlineVisibilityToggleApi {
  const ctx = useOutlineVisibilityContext();
  const isControlled =
    controlled?.visible !== undefined && controlled?.onVisibleChange !== undefined;

  return useMemo(() => {
    if (isControlled && controlled?.onVisibleChange) {
      return {
        ready: true,
        toggle: () => controlled.onVisibleChange!(!(controlled.visible as boolean)),
        visible: controlled.visible as boolean,
      };
    }
    if (ctx) {
      return { ready: true, toggle: ctx.toggle, visible: ctx.visible };
    }
    return { ready: false };
  }, [controlled?.onVisibleChange, controlled?.visible, ctx, isControlled]);
}
