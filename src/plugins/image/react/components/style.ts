import { createStyles } from 'antd-style';

export const useStyles = createStyles(() => ({
  imageContainer: {
    '&.selected': {
      cursor: 'pointer',
      outline: 'none',
    },
    '&.selected::after': {
      backgroundColor: 'rgba(0, 102, 255, 0.15)',
      bottom: 0,
      content: '""',
      left: 0,
      pointerEvents: 'none',
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 10,
    },
    'cursor': 'default',
    'display': 'inline-block',
    'height': 'auto',
    'maxWidth': '100%',
    'outline': '2px solid transparent',
    'position': 'relative',
    'transition': 'border-color 0.2s ease',
    'userSelect': 'none',
    'width': 'auto',
  },

  scaleInfo: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 3,
    color: 'white',
    fontSize: 12,
    left: 0,
    padding: '2px 6px',
    pointerEvents: 'none',
    position: 'absolute',
    top: -25,
    zIndex: 11,
  },
}));
