import { LexicalRenderer } from '@lobehub/editor/renderer';
import { Button, cssVar, Flexbox, Tag, Text } from '@lobehub/ui';
import type { SerializedEditorState } from 'lexical';
import { RotateCcwIcon } from 'lucide-react';
import { type FC, useLayoutEffect, useMemo, useRef, useState } from 'react';

const IMAGE = 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200';
const MISSING = '/__missing__/image.png';
const THUMBHASH = 'lPgNFYJnd4h/h3eEeHiIh1ApB3Zl';
const NATURAL = { naturalHeight: 797, naturalWidth: 1200 };

const CASES: { fields: Record<string, unknown>; title: string }[] = [
  { fields: { ...NATURAL, maxWidth: 1200 }, title: 'naturalWidth / naturalHeight · auto' },
  {
    fields: { ...NATURAL, displayWidth: 50, maxWidth: 1200 },
    title: 'naturalWidth / naturalHeight · 50%',
  },
  {
    fields: { ...NATURAL, maxWidth: 320, thumbhash: THUMBHASH, width: 320 },
    title: 'natural size + thumbhash · 320px',
  },
  { fields: { height: 213, maxWidth: 320, width: 320 }, title: 'legacy width + height · 320px' },
  { fields: { maxWidth: 320, thumbhash: THUMBHASH, width: 320 }, title: 'thumbhash only · 320px' },
  { fields: { maxWidth: 1200 }, title: 'no size data · auto' },
];

const makeValue = (fields: Record<string, unknown>, src: string) =>
  ({
    root: {
      children: [
        { altText: '', src, type: 'block-image', version: 1, ...fields },
        {
          children: [{ text: 'Text below the image', type: 'text', version: 1 }],
          type: 'paragraph',
          version: 1,
        },
      ],
      type: 'root',
      version: 1,
    },
  }) as unknown as SerializedEditorState;

interface ShiftStats {
  final: number;
  first: number;
  shift: number;
}

const Probe: FC<{ fields: Record<string, unknown>; label: string; src: string }> = ({
  fields,
  label,
  src,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<ShiftStats>();
  const value = useMemo(() => makeValue(fields, src), [fields, src]);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const first = Math.round(element.getBoundingClientRect().height);
    let min = first;
    let max = first;
    setStats({ final: first, first, shift: 0 });
    const observer = new ResizeObserver(() => {
      const height = Math.round(element.getBoundingClientRect().height);
      min = Math.min(min, height);
      max = Math.max(max, height);
      setStats({ final: height, first, shift: max - min });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Flexbox flex={1} gap={8} style={{ minWidth: 0 }}>
      <Flexbox horizontal align={'center'} gap={8} justify={'space-between'}>
        <Text type={'secondary'}>{label}</Text>
        {stats && (
          <Tag color={stats.shift > 1 ? 'red' : 'green'}>
            {stats.shift > 1 ? `shifted ${stats.shift}px` : 'no shift'}
          </Tag>
        )}
      </Flexbox>
      <div
        ref={ref}
        style={{ border: `1px dashed ${cssVar.colorBorder}`, borderRadius: 8, padding: 8 }}
      >
        <LexicalRenderer value={value} />
      </div>
      {stats && (
        <Text fontSize={12} type={'secondary'}>
          height {stats.first}px → {stats.final}px
        </Text>
      )}
    </Flexbox>
  );
};

export default () => {
  const [round, setRound] = useState(0);

  return (
    <Flexbox gap={24} padding={16}>
      <Flexbox horizontal align={'center'} gap={12} justify={'space-between'}>
        <Text type={'secondary'}>
          Each card measures its own height from first render to now. Throttle the network in
          DevTools to watch the placeholder longer.
        </Text>
        <Button icon={RotateCcwIcon} onClick={() => setRound((n) => n + 1)}>
          Replay
        </Button>
      </Flexbox>
      {CASES.map(({ fields, title }) => (
        <Flexbox gap={12} key={`${title}-${round}`}>
          <Text strong>{title}</Text>
          <Flexbox horizontal gap={16}>
            <Probe fields={fields} label={'loads'} src={`${IMAGE}&replay=${round}`} />
            <Probe fields={fields} label={'fails'} src={`${MISSING}?replay=${round}`} />
          </Flexbox>
        </Flexbox>
      ))}
    </Flexbox>
  );
};
