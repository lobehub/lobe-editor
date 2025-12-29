import { cssVar } from 'antd-style';

/**
 * Lobe 主题配置
 * 基于 shiki 主题配置，使用 antd-style 的 cssVar 进行颜色映射
 */
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
      // 布尔值 - constant.language.boolean
      '& .cm-atom': {
        color: cssVar.purple10,
      },
      // 属性名 - entity.other.attribute-name
      '& .cm-attribute': {
        color: cssVar.purple10,
      },
      // 内置 - support.module, support.node
      '& .cm-builtin': {
        color: cssVar.volcano10,
        fontStyle: 'italic',
      },
      // 注释 - comment
      '& .cm-comment': {
        color: cssVar.colorTextQuaternary,
        fontStyle: 'italic',
      },
      // 折叠占位符
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
      // 函数名 - entity.name.function, support.function
      '& .cm-function': {
        color: cssVar.geekblue10,
      },
      // 标题 - markup.heading
      '& .cm-header': {
        color: cssVar.colorInfo,
      },
      // 关键字 - keyword, modifier, storage.type, storage.modifier, storage.control
      '& .cm-keyword': {
        color: cssVar.colorInfo,
      },
      // 元数据 - meta
      '& .cm-meta': {
        color: cssVar.colorText,
      },
      '& .cm-modifier': {
        color: cssVar.colorInfo,
      },
      // 数字 - constant.numeric
      '& .cm-number': {
        color: cssVar.volcano10,
      },
      // 操作符 - punctuation, operator
      '& .cm-operator': {
        color: cssVar.colorInfo,
      },
      // 属性 - variable.object.property
      '& .cm-property': {
        color: cssVar.volcano10,
      },
      '& .cm-punctuation': {
        color: cssVar.colorInfo,
      },
      // 限定符 - support.type.property-name
      '& .cm-qualifier': {
        color: cssVar.colorWarning,
      },
      // 字符串 - string
      '& .cm-string': {
        color: cssVar.colorSuccess,
      },
      '& .cm-string-2': {
        color: cssVar.colorSuccess,
      },
      // 标签 - entity.name.tag, meta.tag
      '& .cm-tag': {
        color: cssVar.volcano10,
      },
      '& .cm-tag.cm-bracket': {
        color: cssVar.colorInfo,
      },
      // 类型 - entity.name.type, support.type, storage.type
      '& .cm-type': {
        color: cssVar.colorWarning,
      },
      // 变量 - variable, variable.parameter
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
      // 默认文本颜色
      'color': cssVar.colorText,
      'padding-inline': '12px',
    },
  },
  // 选中背景
  '& .cm-selectionBackground': {
    background: 'transparent',
  },
  // 选中匹配
  '& .cm-selectionMatch': {
    background: `${cssVar.colorFillSecondary} !important`,
  },
  // 编辑器背景
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
  // 聚焦时的选中背景
  '&.cm-editor.cm-focused .cm-selectionBackground': {
    background: cssVar.colorPrimaryBg,
  },
  // 聚焦时的行号颜色
  '&.cm-editor.cm-focused .cm-selectionLineGutter': {
    color: cssVar.colorText,
  },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    background: cssVar.yellow,
  },
};
