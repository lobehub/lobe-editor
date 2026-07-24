/* eslint-disable @typescript-eslint/no-this-alias */

import supersub from 'remark-supersub';

export default function remarkSupersub() {
  // @ts-expect-error: TS is wrong about `this`.

  const self = /** @type {Processor} */ this;
  const data = self.data();

  const fromMarkdownExtensions = data.fromMarkdownExtensions || (data.fromMarkdownExtensions = []);

  fromMarkdownExtensions.push({
    transforms: [supersub()],
  });
}
