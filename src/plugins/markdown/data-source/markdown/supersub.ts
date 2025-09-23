/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-invalid-this */
/* eslint-disable unused-imports/no-unused-vars */
import supersub from 'remark-supersub';

export default function remarkSupersub() {
  // @ts-expect-error: TS is wrong about `this`.
  // eslint-disable-next-line unicorn/no-this-assignment
  const self = /** @type {Processor} */ this;
  const data = self.data();

  const fromMarkdownExtensions = data.fromMarkdownExtensions || (data.fromMarkdownExtensions = []);

  fromMarkdownExtensions.push({
    transforms: [supersub()],
  });
}
