import { cx, Segmented } from '@lobehub/ui';
import { type ChangeEvent, memo, useEffect, useId, useState } from 'react';

import { useTranslation } from '@/editor-kernel/react/useTranslation';
import {
  MEDIA_DISPLAY_MAX,
  MEDIA_DISPLAY_MIN,
  MEDIA_DISPLAY_PRESETS,
  type MediaDisplayMode,
  type MediaDisplaySize,
  sanitizeMediaDisplayWidth,
  sanitizeMediaFixedPx,
  snapMediaDisplayPercent,
} from '@/utils/mediaDisplaySize';

import { styles } from './style';

export interface MediaWidthControlProps {
  className?: string;
  containerWidth?: number;
  naturalWidth?: number;
  onChange: (size: MediaDisplaySize) => void;
  size: MediaDisplaySize;
}

const DEFAULT_PX = 480;

function widthInPx(size: MediaDisplaySize, containerWidth?: number, naturalWidth?: number) {
  switch (size.mode) {
    case 'px': {
      return size.px;
    }
    case 'percent': {
      return containerWidth ? (containerWidth * size.value) / 100 : undefined;
    }
    default: {
      if (naturalWidth && containerWidth) return Math.min(naturalWidth, containerWidth);
      return naturalWidth ?? containerWidth;
    }
  }
}

export function convertMediaDisplaySize(
  from: MediaDisplaySize,
  to: MediaDisplayMode,
  containerWidth?: number,
  naturalWidth?: number,
): MediaDisplaySize {
  if (to === from.mode) return from;
  if (to === 'auto') return { mode: 'auto' };
  const px = widthInPx(from, containerWidth, naturalWidth);
  if (to === 'percent') {
    const value =
      px && containerWidth ? sanitizeMediaDisplayWidth((px / containerWidth) * 100) : undefined;
    return { mode: 'percent', value: value ?? MEDIA_DISPLAY_MAX };
  }
  return { mode: 'px', px: sanitizeMediaFixedPx(px) ?? DEFAULT_PX };
}

const MediaWidthControl = memo<MediaWidthControlProps>(
  ({ className, containerWidth, naturalWidth, onChange, size }) => {
    const t = useTranslation();
    const id = useId();
    const [pxDraft, setPxDraft] = useState<string | null>(null);

    useEffect(() => {
      setPxDraft(null);
    }, [size]);

    const handlePercent = (event: ChangeEvent<HTMLInputElement>) => {
      const value = sanitizeMediaDisplayWidth(snapMediaDisplayPercent(Number(event.target.value)));
      if (value !== undefined) onChange({ mode: 'percent', value });
    };

    const handlePx = (event: ChangeEvent<HTMLInputElement>) => {
      setPxDraft(event.target.value);
      const px = sanitizeMediaFixedPx(Number(event.target.value));
      if (px !== undefined) onChange({ mode: 'px', px });
    };

    return (
      <div className={cx(styles.root, className)}>
        <span className={styles.label} id={`${id}-label`}>
          {t('media.width')}
        </span>
        <div aria-labelledby={`${id}-label`} className={styles.column} role="group">
          <Segmented
            block
            onChange={(mode) =>
              onChange(
                convertMediaDisplaySize(
                  size,
                  mode as MediaDisplayMode,
                  containerWidth,
                  naturalWidth,
                ),
              )
            }
            options={[
              { label: t('media.widthAuto'), value: 'auto' },
              { label: '%', value: 'percent' },
              { label: 'px', value: 'px' },
            ]}
            size="small"
            value={size.mode}
          />
          {size.mode === 'auto' && <span className={styles.hint}>{t('media.widthAutoHint')}</span>}
          {size.mode === 'percent' && (
            <>
              <div className={styles.row}>
                <input
                  aria-label={t('media.widthPercent')}
                  className={styles.slider}
                  max={MEDIA_DISPLAY_MAX}
                  min={MEDIA_DISPLAY_MIN}
                  onChange={handlePercent}
                  step={1}
                  type="range"
                  value={size.value}
                />
                <span className={styles.readout}>{`${size.value}%`}</span>
              </div>
              <div className={styles.presets}>
                {MEDIA_DISPLAY_PRESETS.map((preset) => (
                  <button
                    className={cx(styles.preset, preset === size.value && styles.presetActive)}
                    key={preset}
                    onClick={() => onChange({ mode: 'percent', value: preset })}
                    type="button"
                  >
                    {`${preset}%`}
                  </button>
                ))}
              </div>
            </>
          )}
          {size.mode === 'px' && (
            <div className={styles.row}>
              <input
                aria-label={t('media.widthPx')}
                className={styles.pxInput}
                inputMode="numeric"
                min={1}
                onChange={handlePx}
                type="number"
                value={pxDraft ?? String(size.px)}
              />
              <span className={styles.hint}>px</span>
            </div>
          )}
        </div>
      </div>
    );
  },
);

MediaWidthControl.displayName = 'MediaWidthControl';

export default MediaWidthControl;
