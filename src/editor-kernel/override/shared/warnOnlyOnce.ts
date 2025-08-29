/* eslint-disable @typescript-eslint/no-namespace */
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

// @ts-expect-error not error
if (!globalThis.__DEV__) {
  // @ts-expect-error not error
  globalThis.__DEV__ = true;
}

/*@__INLINE__*/
export default function warnOnlyOnce(message: string): () => void {
  // @ts-expect-error not error
  if (globalThis.__DEV__) {
    let run = false;
    return () => {
      if (!run) {
        console.warn(message);
      }
      run = true;
    };
  } else {
    return () => {};
  }
}
