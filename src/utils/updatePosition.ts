import {
  ComputePositionReturn,
  FloatingElement,
  Placement,
  ReferenceElement,
  computePosition,
  flip,
  offset,
  shift,
} from '@floating-ui/dom';

export const updatePosition = ({
  floating,
  placement = 'bottom-start',
  reference,
  offset: offsetNumber = 8,
  callback,
}: {
  callback?: (props: ComputePositionReturn) => void;
  floating: FloatingElement | null;
  offset?: number;
  placement?: Placement;
  reference: ReferenceElement | null;
}) => {
  if (!reference || !floating) return;
  return computePosition(reference, floating, {
    middleware: [offset(offsetNumber), flip(), shift()],
    placement,
  }).then((props) => {
    if (!floating) return false;
    const { x, y } = props;
    const viewportPadding = 8;
    const viewportMinX = window.scrollX + viewportPadding;
    const viewportMinY = window.scrollY + viewportPadding;

    floating.style.left = `${Math.max(x, viewportMinX)}px`;
    floating.style.top = `${Math.max(y, viewportMinY)}px`;
    callback?.(props);
  });
};

export const cleanPosition = (floating: FloatingElement | null) => {
  if (!floating) return false;
  floating.style.left = '-9999px';
  floating.style.top = '-9999px';
};
