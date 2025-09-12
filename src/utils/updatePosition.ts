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

    floating.style.left = `${x}px`;
    floating.style.top = `${y}px`;
    callback?.(props);
  });
};

export const cleanPosition = (floating: FloatingElement | null) => {
  if (!floating) return false;
  floating.style.left = '-9999px';
  floating.style.top = '-9999px';
};
