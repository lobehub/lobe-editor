---
nav: Plugins
group: Plugins
title: Upload
description: Upload plugin provides comprehensive file upload handling with drag-and-drop support, priority-based handler system, and service-oriented architecture. It manages file uploads from multiple sources including drag-drop and paste operations with customizable upload handlers and error management.
---

## Introduction

Upload plugin serves as the central file upload management system for the editor. It provides a sophisticated service-oriented architecture for handling file uploads from various sources including drag-and-drop operations, paste events, and programmatic uploads. The plugin features a priority-based handler system, comprehensive error handling, and seamless integration with other editor plugins.

## Core Architecture

### Upload Service System

The plugin implements `IUploadService` for centralized upload management:

- **Handler Registration**: Priority-based upload handler system
- **Multi-source Support**: Drag-drop, paste, and programmatic uploads
- **Error Handling**: Comprehensive error management and fallback
- **Service Integration**: Seamless integration with other plugins

### Priority System

Upload handlers are organized by priority levels:

- **HIGH Priority**: `UPLOAD_PRIORITY_HIGH` (0) - Critical handlers
- **MEDIUM Priority**: `UPLOAD_PRIORITY_MEDIUM` (1) - Standard handlers
- **LOW Priority**: `UPLOAD_PRIORITY_LOW` (2) - Fallback handlers

### Event Handling

- **DROP_COMMAND**: Handles drag-and-drop file operations
- **DRAG_DROP_PASTE**: Manages paste operations with files
- **Range Support**: Accurate insertion point detection
- **Event Prevention**: Proper event handling and propagation control

## Plugin Configuration

### UploadPluginOptions

```typescript
interface UploadPluginOptions {
  // Currently no specific options required
  // Configuration is handled through service registration
}
```

## Service API

### IUploadService

Core service interface for upload management:

```typescript
interface IUploadService {
  registerUpload(
    handler: (file: File, from: string, range: Range | null | undefined) => Promise<boolean | null>,
    priority?: UPLOAD_PRIORITY,
  ): void;
  uploadFile(file: File, from: string, range: Range | null | undefined): Promise<boolean>;
}
```

### Upload Handler Signature

```typescript
type UploadHandler = (
  file: File,
  from: string,
  range: Range | null | undefined,
) => Promise<boolean | null>;
```

**Parameters:**

- `file`: The file object to upload
- `from`: Source of the upload ('drop', 'drag-drop-paste', 'programmatic')
- `range`: DOM range for insertion point (null for append)

**Returns:**

- `true`: Upload handled successfully
- `false`: Upload failed, try next handler
- `null`: Upload skipped, try next handler

### Priority Constants

```typescript
const UPLOAD_PRIORITY_HIGH = 0; // Highest priority
const UPLOAD_PRIORITY_MEDIUM = 1; // Medium priority
const UPLOAD_PRIORITY_LOW = 2; // Lowest priority (default)
```

## Usage Examples

### Basic Plugin Setup

```typescript
const uploadPlugin = new UploadPlugin(kernel);

// The plugin automatically registers the upload service
const uploadService = kernel.requireService(IUploadService);
```

### Registering Upload Handlers

```typescript
// High priority image handler
uploadService.registerUpload(async (file, from, range) => {
  if (file.type.startsWith('image/')) {
    const imageUrl = await uploadImageToServer(file);

    // Insert image at the specified range
    editor.update(() => {
      if (range) {
        const selection = $createRangeSelectionFromDOM(range);
        $setSelection(selection);
      }

      editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
        src: imageUrl,
        alt: file.name,
      });
    });

    return true; // Upload handled
  }
  return false; // Not an image, try next handler
}, UPLOAD_PRIORITY_HIGH);

// Medium priority file handler
uploadService.registerUpload(async (file, from, range) => {
  if (file.size < 10 * 1024 * 1024) {
    // Under 10MB
    const fileUrl = await uploadFileToServer(file);

    editor.update(() => {
      if (range) {
        const selection = $createRangeSelectionFromDOM(range);
        $setSelection(selection);
      }

      editor.dispatchCommand(INSERT_FILE_COMMAND, {
        name: file.name,
        fileUrl: fileUrl,
        size: file.size,
        status: 'uploaded',
      });
    });

    return true;
  }
  return false; // File too large
}, UPLOAD_PRIORITY_MEDIUM);

// Low priority fallback handler
uploadService.registerUpload(async (file, from, range) => {
  // Log unsupported files
  console.warn(`Unsupported file type: ${file.type}`);

  // Show user notification
  showNotification(`File type ${file.type} is not supported`);

  return false; // Cannot handle this file
}, UPLOAD_PRIORITY_LOW);
```

### Advanced Upload Handlers

```typescript
// Comprehensive image handler with validation
uploadService.registerUpload(async (file, from, range) => {
  if (!file.type.startsWith('image/')) return false;

  // Validate file size
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    throw new Error('Image size must be under 5MB');
  }

  // Validate image dimensions
  const dimensions = await getImageDimensions(file);
  if (dimensions.width > 4000 || dimensions.height > 4000) {
    throw new Error('Image dimensions must be under 4000x4000px');
  }

  try {
    // Upload with progress tracking
    const imageUrl = await uploadWithProgress(file, (progress) => {
      updateUploadProgress(progress);
    });

    // Insert image node
    editor.update(() => {
      if (range) {
        const selection = $createRangeSelectionFromDOM(range);
        $setSelection(selection);
      }

      const imageNode = $createImageNode({
        src: imageUrl,
        alt: file.name,
        maxWidth: Math.min(dimensions.width, 800),
      });

      $insertNodes([imageNode]);
    });

    return true;
  } catch (error) {
    console.error('Image upload failed:', error);
    showErrorNotification(error.message);
    return false;
  }
}, UPLOAD_PRIORITY_HIGH);
```

### Programmatic Upload

```typescript
// Programmatic file upload
const handleFileSelect = async (file: File) => {
  try {
    const uploadService = kernel.requireService(IUploadService);
    const success = await uploadService.uploadFile(file, 'programmatic', null);

    if (success) {
      showSuccessNotification('File uploaded successfully');
    } else {
      showErrorNotification('File upload failed');
    }
  } catch (error) {
    showErrorNotification(error.message);
  }
};

// Trigger file selection
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.onchange = (e) => {
  const file = e.target.files?.[0];
  if (file) {
    handleFileSelect(file);
  }
};
fileInput.click();
```

### Multiple File Handlers

```typescript
// Register handlers for different file types
const registerFileHandlers = (uploadService: IUploadService) => {
  // Video handler
  uploadService.registerUpload(async (file, from, range) => {
    if (file.type.startsWith('video/')) {
      const videoUrl = await uploadVideo(file);
      insertVideoPlayer(videoUrl, range);
      return true;
    }
    return false;
  }, UPLOAD_PRIORITY_HIGH);

  // Audio handler
  uploadService.registerUpload(async (file, from, range) => {
    if (file.type.startsWith('audio/')) {
      const audioUrl = await uploadAudio(file);
      insertAudioPlayer(audioUrl, range);
      return true;
    }
    return false;
  }, UPLOAD_PRIORITY_HIGH);

  // Document handler
  uploadService.registerUpload(async (file, from, range) => {
    const documentTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (documentTypes.includes(file.type)) {
      const docUrl = await uploadDocument(file);
      insertDocumentLink(file.name, docUrl, range);
      return true;
    }
    return false;
  }, UPLOAD_PRIORITY_MEDIUM);
};
```

### Upload Source Detection

```typescript
uploadService.registerUpload(async (file, from, range) => {
  console.log(`Upload source: ${from}`);

  // Handle differently based on source
  switch (from) {
    case 'drop':
      // User dropped file directly
      showDropNotification('File dropped');
      break;

    case 'drag-drop-paste':
      // User pasted file
      showPasteNotification('File pasted');
      break;

    case 'programmatic':
      // Programmatic upload (e.g., file picker)
      showUploadNotification('File selected');
      break;
  }

  // Process upload normally
  return await processFileUpload(file, range);
}, UPLOAD_PRIORITY_LOW);
```

## Utility Functions

### Range Processing

```typescript
// Get drag selection utility (included in plugin)
function getDragSelection(event: DragEvent): Range | null | undefined {
  let range;
  const domSelection = getDOMSelectionFromTarget(event.target);

  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(event.clientX, event.clientY);
  } else if (event.rangeParent && domSelection !== null) {
    domSelection.collapse(event.rangeParent, event.rangeOffset || 0);
    range = domSelection.getRangeAt(0);
  }

  return range;
}
```

### Error Handling Patterns

```typescript
// Comprehensive error handling
uploadService.registerUpload(async (file, from, range) => {
  try {
    // Validate file
    validateFile(file);

    // Upload file
    const url = await uploadToServer(file);

    // Insert content
    insertContent(url, file, range);

    return true;
  } catch (error) {
    if (error instanceof ValidationError) {
      showValidationError(error.message);
    } else if (error instanceof NetworkError) {
      showNetworkError('Upload failed due to network issues');
    } else if (error instanceof ServerError) {
      showServerError('Server error during upload');
    } else {
      showGenericError('Unknown upload error');
    }

    return false; // Let other handlers try
  }
}, UPLOAD_PRIORITY_MEDIUM);
```

The upload plugin provides a robust and extensible foundation for all file upload operations in the editor, enabling seamless integration of various file types while maintaining proper error handling and user experience standards.
