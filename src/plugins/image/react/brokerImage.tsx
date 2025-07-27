import React, { JSX } from "react";
import brokenImage from "./image-broken.svg";

export function BrokenImage(): JSX.Element {
  return (
    <img
      alt="Broken image"
      draggable="false"
      src={brokenImage}
      style={{
        height: 200,
        opacity: 0.2,
        width: 200,
      }}
    />
  );
}
