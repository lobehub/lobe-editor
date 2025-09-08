---
nav: Plugins
group: Plugins
title: Math
description: Math plugin enables LaTeX-style mathematical expressions in the editor. It provides inline and block math nodes with decorator support, markdown shortcuts, command integration, and React components for rendering mathematical notation with customizable renderers.
atomId: ReactMathPlugin
---

## Introduction

Math plugin provides comprehensive mathematical expression support for the editor using LaTeX syntax. It allows users to create both inline math expressions (`$equation$`) and block math expressions (`$$equation$$`) with real-time rendering capabilities. The plugin features custom node implementations, markdown shortcuts for quick input, command-based insertion, and flexible decorator patterns for custom math rendering.

## Basic Usage

<code src="./demos/index.tsx"></code>

## Core Architecture

### MathNode Types

The plugin introduces two custom node types:

#### MathInlineNode

- **Inline Rendering**: Renders mathematics inline with text flow
- **LaTeX Syntax**: Supports standard LaTeX mathematical notation
- **Decorator Pattern**: Uses configurable decorators for custom rendering
- **Serialization**: Full JSON and DOM import/export support

#### MathBlockNode

- **Block Rendering**: Renders as standalone math blocks
- **Multiline Support**: Handles complex mathematical expressions
- **LaTeX Syntax**: Full LaTeX mathematical notation support
- **Decorator Pattern**: Customizable rendering through decorators

### Plugin System

- **MathPlugin**: Core plugin class with dual node registration
- **Command Integration**: Multiple commands for insertion, updates, and navigation
- **Markdown Shortcuts**: Automatic LaTeX-style shortcuts (`$...$` and `$$`)
- **Selection Management**: Advanced selection handling for math expressions

### Markdown Integration

- **Shortcut System**: Real-time conversion of LaTeX-style syntax
- **Writer Integration**: Converts math nodes to markdown format
- **Import/Export**: Seamless markdown serialization support

## Components

### ReactMathPlugin

React component wrapper providing complete math functionality.

| Property   | Description                    | Type                                          | Default |
| ---------- | ------------------------------ | --------------------------------------------- | ------- |
| className  | Custom CSS class name          | `string`                                      | -       |
| renderComp | Custom math renderer component | `ReactNode`                                   | -       |
| theme      | Theme configuration object     | `{ mathBlock?: string, mathInline?: string }` | -       |

## Commands

### INSERT_MATH_COMMAND

Insert new math expressions programmatically:

```typescript
import { INSERT_MATH_COMMAND } from '@lobehub/editor';

// Insert inline math expression
editor.dispatchCommand(INSERT_MATH_COMMAND, {
  code: 'E = mc^2',
});
```

**Parameters:**

- `code`: LaTeX mathematical expression string

### UPDATE_MATH_COMMAND

Update existing math expressions:

```typescript
import { UPDATE_MATH_COMMAND } from '@lobehub/editor';

// Update math expression by node key
editor.dispatchCommand(UPDATE_MATH_COMMAND, {
  key: 'node-key-123',
  code: '\\frac{a}{b} + c',
});
```

**Parameters:**

- `key`: Node key identifier
- `code`: New LaTeX expression

### SELECT_MATH_SIDE_COMMAND

Navigate around math expressions:

```typescript
import { SELECT_MATH_SIDE_COMMAND } from '@lobehub/editor';

// Select before math node
editor.dispatchCommand(SELECT_MATH_SIDE_COMMAND, {
  key: 'node-key-123',
  prev: true,
});

// Select after math node
editor.dispatchCommand(SELECT_MATH_SIDE_COMMAND, {
  key: 'node-key-123',
  prev: false,
});
```

## Plugin Configuration

### MathPluginOptions

| Property  | Description             | Type                                             | Required |
| --------- | ----------------------- | ------------------------------------------------ | -------- |
| decorator | Math rendering function | `(node: MathNode, editor: LexicalEditor) => any` | Yes      |
| theme     | CSS theme configuration | `{ mathBlock?: string, mathInline?: string }`    | No       |

## Node API

### Math Node Creation

```typescript
// Create inline math node
const inlineMath = $createMathInlineNode('\\alpha + \\beta');

// Create block math node
const blockMath = $createMathBlockNode('\\sum_{i=1}^{n} x_i');

// Check if node is math
if ($isMathNode(node)) {
  // Handle math node logic
}
```

### Math Node Methods

```typescript
// Get LaTeX code
const code = mathNode.code;

// Update LaTeX code
mathNode.updateCode('\\int_0^1 f(x) dx');

// Get text representation
const text = mathNode.getTextContent(); // Returns $code$ or $$code$$
```

## Markdown Shortcuts

The plugin provides automatic LaTeX-style shortcuts:

### Inline Math Shortcut

```typescript
// Type: $E = mc^2$
// Automatically converts to inline math node
```

**Pattern:** `/\$([^$]+)\$\s?$/`
**Trigger:** `$` character

### Block Math Shortcut

```typescript
// Type: $$
// Press Enter to create block math node
```

**Pattern:** `/^(\$\$)$/`
**Trigger:** `enter` key

## Usage Examples

### Basic Setup

```typescript
import { MathPlugin, ReactMathPlugin } from '@lobehub/editor';

// Register the plugin with custom renderer
const mathPlugin = new MathPlugin(kernel, {
  decorator: (node, editor) => {
    return <KaTeXRenderer code={node.code} />;
  },
  theme: {
    mathInline: 'custom-inline-math',
    mathBlock: 'custom-block-math'
  }
});

// Use in React
<Editor
  plugins={[ReactMathPlugin]}
/>
```

### KaTeX Integration

```typescript
import 'katex/dist/katex.min.css';
import katex from 'katex';

const KaTeXRenderer = ({ code, isBlock = false }) => {
  const html = katex.renderToString(code, {
    displayMode: isBlock,
    throwOnError: false
  });

  return (
    <span
      dangerouslySetInnerHTML={{ __html: html }}
      className={isBlock ? 'math-block' : 'math-inline'}
    />
  );
};

// Use with plugin
<ReactMathPlugin
  renderComp={<KaTeXRenderer />}
  theme={{
    mathInline: 'katex-inline',
    mathBlock: 'katex-block'
  }}
/>
```

### MathJax Integration

```typescript
import { MathJax } from 'better-react-mathjax';

const MathJaxRenderer = ({ code, isBlock }) => (
  <MathJax>
    {isBlock ? `$$${code}$$` : `$${code}$`}
  </MathJax>
);
```

### Custom Math Editor

```typescript
const MathEditor = ({ node, editor }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [code, setCode] = useState(node.code);

  const handleSave = () => {
    editor.dispatchCommand(UPDATE_MATH_COMMAND, {
      key: node.getKey(),
      code: code
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
      />
    );
  }

  return (
    <div onClick={() => setIsEditing(true)}>
      <KaTeXRenderer code={code} />
    </div>
  );
};
```

### Programmatic Usage

```typescript
// Insert various math expressions
const insertMath = (expression: string) => {
  editor.dispatchCommand(INSERT_MATH_COMMAND, {
    code: expression,
  });
};

// Examples
insertMath('\\frac{1}{2}'); // Fraction
insertMath('\\sum_{i=1}^{n} i'); // Summation
insertMath('\\int_0^\\infty e^{-x} dx'); // Integral
insertMath('\\begin{matrix} a & b \\\\ c & d \\end{matrix}'); // Matrix
```

## Styling

### Default Theme Classes

```css
.math-inline {
  display: inline-block;
  margin: 0 2px;
  vertical-align: middle;
}

.math-block {
  display: block;
  margin: 16px 0;
  text-align: center;
}
```

### Custom Styling

```typescript
<ReactMathPlugin
  theme={{
    mathInline: 'my-inline-math',
    mathBlock: 'my-block-math'
  }}
/>
```

```css
.my-inline-math {
  background: #f8f9fa;
  border-radius: 4px;
  padding: 2px 4px;
}

.my-block-math {
  background: #fff;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
```

## Advanced Features

### Error Handling

```typescript
const SafeMathRenderer = ({ code }) => {
  try {
    const html = katex.renderToString(code, {
      throwOnError: true
    });
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  } catch (error) {
    return (
      <span className="math-error">
        Invalid LaTeX: {code}
      </span>
    );
  }
};
```

### Math Validation

```typescript
const validateLaTeX = (code: string): boolean => {
  try {
    katex.renderToString(code, { throwOnError: true });
    return true;
  } catch {
    return false;
  }
};
```
