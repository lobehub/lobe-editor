---
nav: Plugins
group: Plugins
title: Horizontal Rule
description: Horizontal Rule (HR) plugin provides divider functionality for content separation. It includes horizontal rule insertion, custom styling, markdown shortcuts, and React components for building rich document structure with visual content dividers.
atomId: ReactHRPlugin
---

## Introduction

Horizontal Rule plugin enables visual content separation through horizontal dividers. It provides simple yet effective content organization capabilities with customizable styling, markdown shortcuts for quick insertion, and React components for seamless integration. The plugin supports various divider styles and responsive design.

## Basic Usage

<code src="./demos/index.tsx"></code>

## Core Architecture

### HR Node System

The plugin implements custom horizontal rule nodes:

- **HorizontalRuleNode**: Custom node extending Lexical's HorizontalRuleNode
- **Visual Separation**: Creates clear content boundaries
- **Styling Support**: Customizable appearance and themes
- **Serialization**: JSON serialization for persistence

### Command System

- **Insert Commands**: Commands for inserting horizontal rules
- **Style Commands**: Update HR appearance and styling
- **Position Management**: Handle HR placement and alignment

### Markdown Integration

- **Shortcuts**: Markdown shortcuts for HR creation (---, \*\*\*, \_\_\_)
- **Export/Import**: Markdown serialization with proper HR formatting
- **Auto-detection**: Automatic HR creation from markdown patterns

## Components

### ReactHRPlugin

React component wrapper for horizontal rule functionality.

| Property  | Description      | Type                              | Default    |
| --------- | ---------------- | --------------------------------- | ---------- |
| style     | HR visual style  | `'solid' \| 'dashed' \| 'dotted'` | `'solid'`  |
| thickness | Line thickness   | `number`                          | `1`        |
| color     | Line color       | `string`                          | `'#ccc'`   |
| margin    | Vertical spacing | `string \| number`                | `'1em'`    |
| width     | HR width         | `string \| number`                | `'100%'`   |
| align     | Alignment        | `'left' \| 'center' \| 'right'`   | `'center'` |

## Commands

### HR Commands

```typescript
// Insert horizontal rule
editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND);

// Insert with custom styling
editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, {
  style: 'dashed',
  thickness: 2,
  color: '#999',
});
```

## Plugin Configuration

### HRPluginOptions

| Property     | Description                | Type      | Default   |
| ------------ | -------------------------- | --------- | --------- |
| theme        | HR CSS theme configuration | `HRTheme` | -         |
| defaultStyle | Default HR style           | `HRStyle` | `'solid'` |
| allowCustom  | Allow custom styling       | `boolean` | `true`    |
| responsive   | Enable responsive behavior | `boolean` | `true`    |

### HRTheme

CSS theme configuration for HR styling:

```typescript
interface HRTheme {
  hr?: string;
  hrSolid?: string;
  hrDashed?: string;
  hrDotted?: string;
  hrCustom?: string;
}
```

### HRStyle

Horizontal rule style configuration:

```typescript
interface HRStyle {
  style?: 'solid' | 'dashed' | 'dotted';
  thickness?: number;
  color?: string;
  margin?: string | number;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}
```

## Utility Functions

### HR Operations

```typescript
// HR node checking
isHorizontalRuleNode(node: LexicalNode): boolean

// HR creation
createHorizontalRule(style?: HRStyle): HorizontalRuleNode

// HR styling
applyHRStyle(node: HorizontalRuleNode, style: HRStyle): void
getHRStyle(node: HorizontalRuleNode): HRStyle

// HR positioning
insertHRAtSelection(): void
insertHRAfterNode(node: LexicalNode): void
```

### Markdown Integration

```typescript
// Supported markdown patterns
const HR_PATTERNS = {
  threeHyphens: /^---+$/,
  threeAsterisks: /^\*\*\*+$/,
  threeUnderscores: /^___+$/,
};

// Markdown transformer
const HR_TRANSFORMER = {
  dependencies: [HorizontalRuleNode],
  export: () => '---',
  regExp: /^(---|\*\*\*|___)$/,
  replace: (textNode) => {
    return createHorizontalRule();
  },
  trigger: 'Enter',
  type: 'element',
};
```

## Usage Examples

### Basic HR Setup

```typescript
const hrPlugin = new HRPlugin(kernel, {
  theme: {
    hr: 'custom-hr',
    hrSolid: 'hr-solid',
    hrDashed: 'hr-dashed',
  },
  defaultStyle: 'solid',
  allowCustom: true,
  responsive: true,
});
```

### Programmatic HR Insertion

```typescript
// Insert basic horizontal rule
editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND);

// Insert styled horizontal rule
editor.update(() => {
  const hr = createHorizontalRule({
    style: 'dashed',
    thickness: 2,
    color: '#007acc',
    margin: '2em',
    width: '80%',
  });
  $insertNodes([hr]);
});
```

### Custom HR Styles

```typescript
// Define custom HR styles
const customHRStyles = {
  subtle: {
    style: 'solid',
    thickness: 1,
    color: '#f0f0f0',
    margin: '0.5em',
  },
  bold: {
    style: 'solid',
    thickness: 3,
    color: '#333',
    margin: '2em',
  },
  decorative: {
    style: 'dashed',
    thickness: 2,
    color: '#007acc',
    margin: '1.5em',
    width: '50%',
    align: 'center',
  },
};

// Apply custom style
const insertCustomHR = (styleName: keyof typeof customHRStyles) => {
  editor.update(() => {
    const hr = createHorizontalRule(customHRStyles[styleName]);
    $insertNodes([hr]);
  });
};
```

### Markdown Shortcuts

```typescript
// Enable markdown shortcuts
const markdownShortcuts = [
  '---', // Three hyphens
  '***', // Three asterisks
  '___', // Three underscores
];

// Custom markdown detection
const detectHRPattern = (text: string): boolean => {
  return /^(---|\*\*\*|___)$/.test(text.trim());
};

// Auto-convert on Enter
editor.registerCommand(
  KEY_ENTER_COMMAND,
  (event) => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const anchorNode = selection.anchor.getNode();
      const text = anchorNode.getTextContent();

      if (detectHRPattern(text)) {
        event.preventDefault();
        anchorNode.remove();
        editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND);
        return true;
      }
    }
    return false;
  },
  COMMAND_PRIORITY_HIGH,
);
```

### Responsive HR Component

```typescript
const ResponsiveHR = ({ style = 'solid', responsive = true }) => {
  const hrStyle = {
    borderStyle: style,
    borderWidth: responsive ? 'clamp(1px, 0.1vw, 3px)' : '1px',
    margin: responsive ? 'clamp(0.5em, 2vw, 2em) 0' : '1em 0',
    width: '100%'
  };

  return (
    <hr
      className={`horizontal-rule hr-${style}`}
      style={hrStyle}
    />
  );
};
```

### Interactive HR Editor

```typescript
const HREditor = ({ node, onUpdate }) => {
  const [style, setStyle] = useState(node.getStyle() || 'solid');
  const [thickness, setThickness] = useState(node.getThickness() || 1);
  const [color, setColor] = useState(node.getColor() || '#ccc');

  const handleUpdate = () => {
    const newStyle = { style, thickness, color };
    applyHRStyle(node, newStyle);
    onUpdate?.(newStyle);
  };

  return (
    <div className="hr-editor">
      <select value={style} onChange={(e) => setStyle(e.target.value)}>
        <option value="solid">Solid</option>
        <option value="dashed">Dashed</option>
        <option value="dotted">Dotted</option>
      </select>

      <input
        type="range"
        min="1"
        max="5"
        value={thickness}
        onChange={(e) => setThickness(Number(e.target.value))}
      />

      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
      />

      <button onClick={handleUpdate}>Apply</button>
    </div>
  );
};
```
