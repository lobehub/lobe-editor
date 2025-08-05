import { JSX } from 'react';

import { imageBroken } from './style';

export function BrokenImage(): JSX.Element {
  return (
    <img
      alt="Broken image"
      draggable="false"
      src={imageBroken}
      style={{
        height: 'auto',
        width: 200,
      }}
    />
  );
}
