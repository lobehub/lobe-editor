import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token }) => ({
  imageContainer: {
    '&.selected': {
      cursor: 'pointer',
      outline: `2px solid ${token['blue-6']}`,
    },
    'cursor': 'default',
    'display': 'inline-block',
    'height': 'auto',
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
