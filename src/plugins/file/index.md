---
nav: Plugins
group: Plugins
title: File
description: File plugin provides comprehensive file attachment capabilities with internationalization support. It includes file insertion, upload status management, custom file nodes, utility functions, and React components for building rich file handling experiences with drag-and-drop support.
atomId: ReactFilePlugin
---

## Introduction

File plugin enables advanced file attachment functionality in the editor. It supports file insertion, upload status tracking, file size management, and provides a sophisticated file node system with serialization capabilities. The plugin includes internationalization support, custom styling options, and React components for seamless file integration with drag-and-drop functionality.

## Basic Usage

<code src="./demos/index.tsx"></code>

## Core Architecture

### File Node System

The plugin implements custom file nodes:

- **FileNode**: Custom node extending DecoratorNode for file attachments
- **Status Management**: Track file upload states (pending, uploaded, error)
- **Metadata Storage**: Store file information (name, size, URL, status)
- **Serialization**: JSON serialization for persistence and transport

### Command System

- **INSERT_FILE_COMMAND**: Insert file attachments with configuration options
- **Status Commands**: Update file upload status and error states
- **File Management**: Handle file operations and metadata updates

### Internationalization

- **i18n Support**: Built-in internationalization for file-related text
- **Localized Labels**: Translatable file commands and interface elements
- **Multiple Languages**: Support for various locales and languages

### File Features

- **Drag & Drop**: Native drag-and-drop file insertion
- **Upload States**: Visual feedback for file upload progress
- **File Types**: Support for various file types and extensions
- **Size Validation**: File size limits and validation
- **Error Handling**: Comprehensive error state management

## Components

### ReactFilePlugin

React component wrapper for file functionality.

| Property   | Description            | Type                                 | Default     |
| ---------- | ---------------------- | ------------------------------------ | ----------- |
| name       | File name              | `string`                             | -           |
| fileUrl    | File download URL      | `string`                             | -           |
| size       | File size in bytes     | `number`                             | -           |
| status     | Upload status          | `'pending' \| 'uploaded' \| 'error'` | `'pending'` |
| message    | Status message         | `string`                             | -           |
| onDownload | Download event handler | `() => void`                         | -           |
| onRemove   | Remove event handler   | `() => void`                         | -           |
| onRetry    | Retry upload handler   | `() => void`                         | -           |

## Commands

### INSERT_FILE_COMMAND

Insert a file attachment into the editor:

```typescript
editor.dispatchCommand(INSERT_FILE_COMMAND, {
  name: 'document.pdf',
  fileUrl: 'https://example.com/files/document.pdf',
  size: 1024000,
  status: 'uploaded',
});
```

**Parameters:**

- `name`: File name (required)
- `fileUrl`: File download URL
- `size`: File size in bytes
- `status`: Upload status
- `message`: Status or error message

## Plugin Configuration

### FilePluginOptions

| Property        | Description                   | Type              | Default |
| --------------- | ----------------------------- | ----------------- | ------- |
| theme           | File CSS theme configuration  | `FileTheme`       | -       |
| maxFileSize     | Maximum file size limit       | `number`          | -       |
| allowedTypes    | Allowed file types/extensions | `string[]`        | -       |
| uploadHandler   | Custom upload function        | `UploadHandler`   | -       |
| downloadHandler | Custom download function      | `DownloadHandler` | -       |

### FileTheme

CSS theme configuration for file styling:

```typescript
interface FileTheme {
  file?: string;
  fileName?: string;
  fileSize?: string;
  fileStatus?: string;
  filePending?: string;
  fileUploaded?: string;
  fileError?: string;
  fileActions?: string;
}
```

### SerializedFileNode

File node serialization format:

```typescript
interface SerializedFileNode {
  name: string;
  fileUrl?: string;
  size?: number;
  status?: 'pending' | 'uploaded' | 'error';
  message?: string;
}
```

## Node API

### FileNode Methods

```typescript
// Get/set file name
getName(): string
setName(name: string): void

// Get/set file URL
getFileUrl(): string | undefined
setFileUrl(url: string): void

// Get/set file size
getSize(): number | undefined
setSize(size: number): void

// Get/set upload status
getStatus(): 'pending' | 'uploaded' | 'error'
setStatus(status: 'pending' | 'uploaded' | 'error'): void

// Get/set status message
getMessage(): string | undefined
setMessage(message: string): void

// Update file data
updateFromJSON(data: SerializedFileNode): FileNode
```

## Utility Functions

### File Operations

```typescript
// File size formatting
formatFileSize(bytes: number): string

// File type detection
getFileType(filename: string): string
getFileExtension(filename: string): string

// File validation
validateFileSize(size: number, maxSize: number): boolean
validateFileType(filename: string, allowedTypes: string[]): boolean

// Upload status helpers
isFilePending(node: FileNode): boolean
isFileUploaded(node: FileNode): boolean
isFileError(node: FileNode): boolean
```

## Internationalization

The plugin includes i18n support for file-related text:

```typescript
// Example translations
{
  "file.insert": "Insert File",
  "file.upload": "Upload File",
  "file.download": "Download File",
  "file.remove": "Remove File",
  "file.retry": "Retry Upload",
  "file.pending": "Uploading...",
  "file.uploaded": "Upload Complete",
  "file.error": "Upload Failed",
  "file.sizeLimit": "File size exceeds limit",
  "file.typeNotAllowed": "File type not allowed"
}
```

## Usage Examples

### Basic File Setup

```typescript
const filePlugin = new FilePlugin(kernel, {
  theme: {
    file: 'custom-file',
    fileName: 'custom-file-name',
    fileStatus: 'custom-status',
  },
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['.pdf', '.doc', '.docx', '.txt'],
  uploadHandler: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    return response.json();
  },
});
```

### Programmatic File Insertion

```typescript
// Insert uploaded file
editor.dispatchCommand(INSERT_FILE_COMMAND, {
  name: 'report.pdf',
  fileUrl: '/uploads/report.pdf',
  size: 2048000,
  status: 'uploaded',
});

// Insert pending upload
editor.dispatchCommand(INSERT_FILE_COMMAND, {
  name: 'document.docx',
  size: 1024000,
  status: 'pending',
  message: 'Uploading...',
});
```

### Drag & Drop Implementation

```typescript
const handleFileDrop = async (files: FileList) => {
  Array.from(files).forEach(async (file) => {
    // Insert as pending
    const fileNode = editor.dispatchCommand(INSERT_FILE_COMMAND, {
      name: file.name,
      size: file.size,
      status: 'pending',
    });

    try {
      const uploadResult = await uploadFile(file);
      // Update to uploaded
      fileNode.setFileUrl(uploadResult.url);
      fileNode.setStatus('uploaded');
    } catch (error) {
      // Update to error
      fileNode.setStatus('error');
      fileNode.setMessage(error.message);
    }
  });
};
```

### Custom File Component

```typescript
const CustomFileComponent = ({ node, editor }) => {
  const handleDownload = () => {
    const url = node.getFileUrl();
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleRetry = async () => {
    node.setStatus('pending');
    try {
      const result = await retryUpload(node.getName());
      node.setFileUrl(result.url);
      node.setStatus('uploaded');
    } catch (error) {
      node.setStatus('error');
      node.setMessage(error.message);
    }
  };

  return (
    <div className={`file-attachment ${node.getStatus()}`}>
      <div className="file-info">
        <span className="file-name">{node.getName()}</span>
        <span className="file-size">
          {formatFileSize(node.getSize() || 0)}
        </span>
      </div>
      <div className="file-actions">
        {node.getStatus() === 'uploaded' && (
          <button onClick={handleDownload}>Download</button>
        )}
        {node.getStatus() === 'error' && (
          <button onClick={handleRetry}>Retry</button>
        )}
      </div>
    </div>
  );
};
```
