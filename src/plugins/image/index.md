---
nav: Plugins
group: Plugins
title: Image
description: Image plugin provides comprehensive image handling capabilities with internationalization support. It includes image insertion, resizing, caption management, custom image nodes, and React components for building rich image editing experiences with drag-and-drop support.
atomId: ReactImagePlugin
---

## Introduction

Image plugin enables advanced image handling in the editor. It supports image insertion, resizing, caption editing, and provides a sophisticated image node system with serialization capabilities. The plugin includes internationalization support, custom styling options, and React components for seamless image integration with drag-and-drop functionality.

## Basic Usage

<code src="./demos/index.tsx"></code>

## Core Architecture

### Image Node System

The plugin implements custom image nodes:

- **BaseImageNode**: Foundation image node with core functionality
- **ImageNode**: Enhanced image node with advanced features
- **Caption Support**: Integrated caption editing with nested editor
- **Serialization**: JSON serialization for persistence and transport

### Command System

- **INSERT_IMAGE_COMMAND**: Insert images with various configuration options
- **Resize Commands**: Handle image resizing and dimension management
- **Caption Commands**: Manage image captions and visibility

### Internationalization

- **i18n Support**: Built-in internationalization for image-related text
- **Localized Labels**: Translatable image commands and interface elements
- **Multiple Languages**: Support for various locales and languages

### Image Features

- **Drag & Drop**: Native drag-and-drop image insertion
- **Resizing**: Interactive image resizing with aspect ratio preservation
- **Captions**: Rich text captions with full editor functionality
- **Loading States**: Support for image loading and error states

## Components

### ReactImagePlugin

React component wrapper for image functionality.

| Property        | Description                  | Type                     | Default |
| --------------- | ---------------------------- | ------------------------ | ------- |
| src             | Image source URL             | `string`                 | -       |
| alt             | Alternative text             | `string`                 | -       |
| width           | Image width                  | `number`                 | -       |
| height          | Image height                 | `number`                 | -       |
| maxWidth        | Maximum width constraint     | `number`                 | -       |
| showCaption     | Show/hide caption            | `boolean`                | `false` |
| captionsEnabled | Enable caption functionality | `boolean`                | `true`  |
| onLoad          | Image load event handler     | `() => void`             | -       |
| onError         | Image error event handler    | `(error: Error) => void` | -       |
| onResize        | Image resize event handler   | `(dimensions) => void`   | -       |

## Commands

### INSERT_IMAGE_COMMAND

Insert an image into the editor:

```typescript
editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
  src: 'https://example.com/image.jpg',
  alt: 'Example image',
  width: 500,
  height: 300,
  maxWidth: 800,
  showCaption: true,
});
```

**Parameters:**

- `src`: Image source URL (required)
- `alt`: Alternative text for accessibility
- `width`: Initial image width
- `height`: Initial image height
- `maxWidth`: Maximum width constraint
- `showCaption`: Whether to show caption initially

## Plugin Configuration

### ImagePluginOptions

| Property        | Description                    | Type         | Default |
| --------------- | ------------------------------ | ------------ | ------- |
| theme           | Image CSS theme configuration  | `ImageTheme` | -       |
| maxWidth        | Default maximum width          | `number`     | `800`   |
| captionsEnabled | Enable caption functionality   | `boolean`    | `true`  |
| resizeEnabled   | Enable image resizing          | `boolean`    | `true`  |
| dragDropEnabled | Enable drag-and-drop insertion | `boolean`    | `true`  |

### ImageTheme

CSS theme configuration for image styling:

```typescript
interface ImageTheme {
  image?: string;
  imageCaption?: string;
  imageResizer?: string;
  imageSelected?: string;
  imageLoading?: string;
  imageError?: string;
}
```

### ImagePayload

Configuration object for image insertion:

```typescript
interface ImagePayload {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  maxWidth?: number;
  showCaption?: boolean;
  captionsEnabled?: boolean;
  key?: NodeKey;
}
```

## Node API

### BaseImageNode Methods

```typescript
// Get/set image source
getSrc(): string
setSrc(src: string): void

// Get/set alternative text
getAltText(): string
setAltText(alt: string): void

// Get/set dimensions
getWidth(): number | 'inherit'
setWidth(width: number | 'inherit'): void

getHeight(): number | 'inherit'
setHeight(height: number | 'inherit'): void

// Caption management
getShowCaption(): boolean
setShowCaption(show: boolean): void

getCaptionEditor(): LexicalEditor
```

## Internationalization

The plugin includes i18n support for image-related text:

```typescript
// Example translations
{
  "image.insert": "Insert Image",
  "image.upload": "Upload Image",
  "image.caption": "Image Caption",
  "image.altText": "Alternative Text",
  "image.resize": "Resize Image",
  "image.delete": "Delete Image",
  "image.loading": "Loading image...",
  "image.error": "Failed to load image"
}
```

## Usage Examples

### Basic Image Setup

```typescript
const imagePlugin = new ImagePlugin(kernel, {
  theme: {
    image: 'custom-image',
    imageCaption: 'custom-caption',
    imageResizer: 'custom-resizer',
  },
  maxWidth: 1000,
  captionsEnabled: true,
  resizeEnabled: true,
});
```

### Programmatic Image Insertion

```typescript
// Insert image with caption
editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
  src: '/uploads/photo.jpg',
  alt: 'Beautiful landscape photo',
  width: 600,
  maxWidth: 800,
  showCaption: true,
});
```

### Drag & Drop Implementation

```typescript
const handleImageDrop = (files: FileList) => {
  Array.from(files).forEach((file) => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
          src: reader.result as string,
          alt: file.name,
          maxWidth: 800,
        });
      };
      reader.readAsDataURL(file);
    }
  });
};
```

### Custom Image Component

```typescript
const CustomImageComponent = ({ node, editor }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <div className="custom-image-wrapper">
      <img
        src={node.getSrc()}
        alt={node.getAltText()}
        onLoad={() => setIsLoading(false)}
        onError={() => setHasError(true)}
        style={{
          width: node.getWidth(),
          height: node.getHeight(),
          maxWidth: node.getMaxWidth()
        }}
      />
      {node.getShowCaption() && (
        <div className="image-caption">
          <LexicalNestedComposer initialEditor={node.getCaptionEditor()}>
            <RichTextPlugin />
          </LexicalNestedComposer>
        </div>
      )}
    </div>
  );
};
```
