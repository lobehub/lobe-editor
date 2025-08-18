---
nav: Components
group: Data Entry
title: CodeLanguageSelect
description: CodeLanguageSelect is a specialized select component for choosing programming languages. It provides a comprehensive list of programming languages with icons, built on top of the Shiki syntax highlighting library and LobeHub UI components.
apiHeader:
  pkg: '@lobehub/editor/react'
  docUrl: 'https://github.com/lobehub/lobe-editor/tree/master/src/react/CodeLanguageSelect/index.md'
  sourceUrl: 'https://github.com/lobehub/lobe-editor/tree/master/src/react/CodeLanguageSelect/index.ts'
---

## Introduction

CodeLanguageSelect is a specialized select component that provides an extensive list of programming languages for code editing interfaces. It leverages the Shiki library's bundled language information to offer a comprehensive selection of programming languages, each displayed with appropriate file type icons for better visual recognition.

## Basic Usage

<code src="./demos/index.tsx" center></code>

## APIs

### CodeLanguageSelect

This component extends the `SelectProps` from `@lobehub/ui` and automatically provides language options. All Select component properties are supported except `options`, which is automatically generated from the available programming languages.

| Property    | Description             | Type                         | Default |
| ----------- | ----------------------- | ---------------------------- | ------- |
| className   | Custom CSS class        | `string`                     | -       |
| value       | Selected language value | `SelectProps['value']`       | -       |
| onChange    | Change event handler    | `SelectProps['onChange']`    | -       |
| placeholder | Placeholder text        | `SelectProps['placeholder']` | -       |
| disabled    | Disable the select      | `boolean`                    | `false` |

Note: This component automatically includes all programming languages supported by Shiki, plus a "Plaintext" option. Each language option displays with its corresponding file type icon for better visual identification.
