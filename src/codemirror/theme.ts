import { cssVar } from 'antd-style';

export const lobeTheme = {
  '&': {
    '& .cm-cursor': {
      'border-left-color': cssVar.colorPrimary,
    },
    '& .cm-cursor.cm-cursor-primary': {
      'border-inline-start': `2px solid ${cssVar.colorPrimary} !important`,
    },
    '& .cm-gutters': {
      'background-color': cssVar.colorBgContainer,
      'border': 'none',
      'color': cssVar.colorTextQuaternary,
      'cursor': 'default',
    },
    '& .cm-line': {
      '& .cm-atom': {
        color: cssVar.purple10,
      },
      '& .cm-attribute': {
        color: cssVar.purple10,
      },
      '& .cm-builtin': {
        color: cssVar.volcano10,
        fontStyle: 'italic',
      },
      '& .cm-comment': {
        color: cssVar.colorTextQuaternary,
        fontStyle: 'italic',
      },
      '& .cm-foldPlaceholder': {
        'background': `url("data:image/svg+xml,%3Csvg width='16' height='16' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Crect fill='%23E8E8E8' width='16' height='16' rx='2'/%3E%3Cpath d='M2.75 7.984a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm4.375 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm4.375 0a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Z' fill='%232A3238'/%3E%3C/g%3E%3C/svg%3E") no-repeat`,
        'border': 'none',
        'color': 'transparent',
        'display': 'inline-block',
        'height': '16px',
        'padding': 0,
        'vertical-align': 'middle',
        'width': '16px',
      },
      '& .cm-function': {
        color: cssVar.geekblue10,
      },
      '& .cm-header': {
        color: cssVar.colorInfo,
      },
      '& .cm-keyword': {
        color: cssVar.colorInfo,
      },
      '& .cm-meta': {
        color: cssVar.colorText,
      },
      '& .cm-modifier': {
        color: cssVar.colorInfo,
      },
      '& .cm-number': {
        color: cssVar.volcano10,
      },
      '& .cm-operator': {
        color: cssVar.colorInfo,
      },
      '& .cm-property': {
        color: cssVar.volcano10,
      },
      '& .cm-punctuation': {
        color: cssVar.colorInfo,
      },
      '& .cm-qualifier': {
        color: cssVar.colorWarning,
      },
      '& .cm-string': {
        color: cssVar.colorSuccess,
      },
      '& .cm-string-2': {
        color: cssVar.colorSuccess,
      },
      '& .cm-tag': {
        color: cssVar.volcano10,
      },
      '& .cm-tag.cm-bracket': {
        color: cssVar.colorInfo,
      },
      '& .cm-type': {
        color: cssVar.colorWarning,
      },
      '& .cm-variable': {
        color: cssVar.colorText,
      },
      '& .cm-variable-2': {
        color: cssVar.geekblue10,
      },
      '& .cm-variable-3': {
        color: cssVar.colorWarning,
      },
      '& .cm-variable.cm-callee': {
        color: cssVar.geekblue10,
      },
      '& .cm-variable.cm-def': {
        color: cssVar.colorText,
      },
      'color': cssVar.colorText,
      'padding-inline': '12px',
    },
  },
  '& .cm-selectionBackground': {
    background: 'transparent',
  },
  '& .cm-selectionMatch': {
    background: `${cssVar.colorFillSecondary} !important`,
  },
  '&.cm-editor': {
    'background': 'transparent',
    'cursor': 'text',
    'padding-block': '12px',
    'width': '100%',
  },
  '&.cm-editor span': {
    'font-family': cssVar.fontFamilyCode,
    'font-size': 'calc(var(--lobe-markdown-font-size) * 0.8)',
  },
  '&.cm-editor.cm-focused .cm-selectionBackground': {
    background: cssVar.colorPrimaryBg,
  },
  '&.cm-editor.cm-focused .cm-selectionLineGutter': {
    color: cssVar.colorText,
  },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    background: cssVar.yellow,
  },
};
