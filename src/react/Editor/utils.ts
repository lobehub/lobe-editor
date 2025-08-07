import { ComponentProps, FC } from "react";

export function withProps<T extends FC<any>>(plugin: T, props: ComponentProps<T>): [T, ComponentProps<T>] {
  return [plugin, props];
}
