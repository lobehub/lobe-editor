import { EditorState } from "lexical";
import { IServiceID } from "./types";

export function genServiceId<T>(name: string): IServiceID<T> {
    return { __serviceId: name } as IServiceID<T>;
}

export const noop = () => {};

export function createEmptyEditorState() {
    return new EditorState(new Map(), null);
}

export function assert(
    cond?: boolean,
    message?: string,
): asserts cond {
    if (cond) {
        return;
    }

    throw new Error(
        message,
    );
}
