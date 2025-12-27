/* eslint-disable @typescript-eslint/no-unused-vars */
import { DOMParser } from '@xmldom/xmldom';
import type { ElementNode, LexicalEditor } from 'lexical';
import { $getRoot, $getSelection, $isElementNode, $isRangeSelection } from 'lexical';

import { DataSource } from '@/editor-kernel';
import type { IWriteOptions } from '@/editor-kernel/data-source';
import { INodeHelper } from '@/editor-kernel/inode/helper';
import { INodeService } from '@/plugins/inode';
import { IServiceID } from '@/types';
import { createDebugLogger } from '@/utils/debug';

import type { ILitexmlService, IWriterContext, IXmlNode } from '../service/litexml-service';
import { LitexmlService } from '../service/litexml-service';
import { $parseSerializedNodeImpl, charToId, idToChar } from '../utils';

const logger = createDebugLogger('plugin', 'litexml');

class IXmlWriterContext implements IWriterContext {
  createXmlNode(
    tagName: string,
    attributes?: { [key: string]: string },
    textContent?: string,
  ): IXmlNode {
    return {
      attributes: attributes || {},
      children: [],
      tagName,
      textContent,
    };
  }
}

/**
 * LitexmlDataSource - Handles conversion between Lexical editor state and XML format
 * Provides read (parse XML to Lexical) and write (export Lexical to XML) capabilities
 */
export default class LitexmlDataSource extends DataSource {
  private litexmlService: ILitexmlService;
  private ctx: IXmlWriterContext = new IXmlWriterContext();

  constructor(
    protected dataType: string = 'litexml',
    protected getService?: <T>(serviceId: IServiceID<T>) => T | null,
    service?: ILitexmlService,
  ) {
    super(dataType);
    this.litexmlService = service || new LitexmlService();
  }

  readLiteXMLToInode(litexml: string): any {
    if (typeof litexml !== 'string') {
      throw new Error('Invalid data type. Expected string, got ' + typeof litexml);
    }
    const xml = this.parseXMLString(litexml);
    const inode = this.xmlToLexical(xml);

    this.getService?.(INodeService)?.processNodeTree(inode);
    logger.debug('Parsed XML to Lexical State:', inode);

    return inode;
  }

  /**
   * Parse XML string and set it to the editor
   * @param editor - The Lexical editor instance
   * @param data - XML string to parse
   */
  read(editor: LexicalEditor, data: string): void {
    try {
      const inode = this.readLiteXMLToInode(data);

      const newState = editor.parseEditorState(
        {
          root: INodeHelper.createRootNode(),
        },
        (state) => {
          try {
            const root = $parseSerializedNodeImpl(inode.root, editor, true, state);
            state._nodeMap.set(root.getKey(), root);
          } catch (error) {
            console.error(error);
          }
        },
      );

      editor.setEditorState(newState);
    } catch (error) {
      logger.error('Failed to parse XML:', error);
      throw error;
    }
  }

  /**
   * Export editor content to XML format
   * @param editor - The Lexical editor instance
   * @param options - Write options (e.g., selection flag)
   * @returns XML string representation of the editor content
   */
  write(editor: LexicalEditor, options?: IWriteOptions): any {
    try {
      if (options?.selection) {
        return editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!selection) {
            return null;
          }

          if ($isRangeSelection(selection)) {
            const selectedNodes = selection.getNodes();
            const rootNode = INodeHelper.createRootNode();

            // Wrap inline nodes in a paragraph
            if (selectedNodes.some((node) => node.isInline())) {
              const p = INodeHelper.createParagraph();
              INodeHelper.appendChild(p, ...selectedNodes.map((node) => node.exportJSON()));
              INodeHelper.appendChild(rootNode, p);
            } else {
              INodeHelper.appendChild(rootNode, ...selectedNodes.map((node) => node.exportJSON()));
            }

            const editorState = editor.parseEditorState({ root: rootNode });

            return editorState.read(() => {
              const lexicalRootNode = $getRoot();
              return this.lexicalToXML(lexicalRootNode);
            });
          }

          return null;
        });
      }

      return editor.getEditorState().read(() => {
        const rootNode = $getRoot();
        return this.lexicalToXML(rootNode);
      });
    } catch (error) {
      logger.error('Failed to export to XML:', error);
      throw error;
    }
  }

  /**
   * Parse XML string using browser's built-in parser
   */
  private parseXMLString(xmlString: string): Document {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    if (doc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Invalid XML: ' + xmlString);
    }

    return doc;
  }

  /**
   * Convert XML document to Lexical node structure
   */
  private xmlToLexical(xml: Document): any {
    const rootNode = INodeHelper.createRootNode();

    // Process XML root element's children
    const xmlRoot = xml.documentElement;
    if (xmlRoot) {
      this.processXMLElement(xmlRoot, rootNode);
    }

    return { root: rootNode };
  }

  /**
   * Recursively process XML elements and convert to Lexical nodes
   */
  private processXMLElement(xmlElement: Element, parentNode: any): void {
    const tagName = xmlElement.tagName.toLowerCase();
    const customReaders = this.litexmlService.getXMLReaders();

    // Check if there's a custom reader for this tag
    if (customReaders[tagName]) {
      const readerOrReaders = customReaders[tagName];
      const readers = Array.isArray(readerOrReaders) ? readerOrReaders : [readerOrReaders];

      for (const reader of readers) {
        const children: any[] = [];
        this.processXMLChildren(xmlElement, { children } as any);
        const result = reader(xmlElement, children);

        if (result !== false) {
          if (Array.isArray(result)) {
            if (result.length > 0) {
              const attrId = xmlElement.getAttribute('id');
              result[0].id = attrId ? charToId(attrId) : undefined;
            }
            INodeHelper.appendChild(parentNode, ...result);
          } else if (result) {
            const attrId = xmlElement.getAttribute('id');
            result.id = attrId ? charToId(attrId) : undefined;
            INodeHelper.appendChild(parentNode, result);
          }
          return; // Custom reader handled it
        }
      }
    }

    // Fall back to built-in handlers
    switch (tagName) {
      case 'p':
      case 'paragraph': {
        const paragraph = INodeHelper.createParagraph();
        this.processXMLChildren(xmlElement, paragraph);
        INodeHelper.appendChild(parentNode, paragraph);
        break;
      }

      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        const level = parseInt(tagName.charAt(1));
        const heading = INodeHelper.createElementNode('heading', {
          children: [],
          tag: `h${level}`,
        });
        this.processXMLChildren(xmlElement, heading);
        INodeHelper.appendChild(parentNode, heading);
        break;
      }

      case 'ul':
      case 'ol': {
        xmlElement.querySelectorAll(':scope > li').forEach((li) => {
          const listItem = INodeHelper.createElementNode('listitem', {
            children: [],
            value: 1,
          });
          this.processXMLChildren(li, listItem);
          INodeHelper.appendChild(parentNode, listItem);
        });
        break;
      }

      case 'blockquote': {
        const quote = INodeHelper.createElementNode('quote', {
          children: [],
        });
        this.processXMLChildren(xmlElement, quote);
        INodeHelper.appendChild(parentNode, quote);
        break;
      }

      case 'code': {
        const codeNode = INodeHelper.createElementNode('codeInline', {
          children: [INodeHelper.createTextNode(xmlElement.textContent || '')],
        });
        INodeHelper.appendChild(parentNode, codeNode);
        break;
      }

      case 'text': {
        const textContent = xmlElement.textContent || '';
        if (textContent) {
          const textNode = INodeHelper.createTextNode(textContent);
          INodeHelper.appendChild(parentNode, textNode);
        }
        break;
      }

      default: {
        // Treat unknown tags as generic containers
        this.processXMLChildren(xmlElement, parentNode);
      }
    }
  }

  /**
   * Process XML element's children
   */
  private processXMLChildren(xmlElement: Element | Document, parentNode: any): void {
    Array.from(xmlElement.childNodes).forEach((child) => {
      if (child.nodeType === 1) {
        // Element node
        this.processXMLElement(child as Element, parentNode);
      } else if (child.nodeType === 3) {
        // Text node
        const text = child.textContent || '';
        if (text.trim()) {
          const textNode = INodeHelper.createTextNode(text);
          INodeHelper.appendChild(parentNode, textNode);
        }
      }
    });
  }

  /**
   * Convert Lexical node structure to XML string
   */
  private lexicalToXML(rootNode: ElementNode): string {
    const xmlLines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
    xmlLines.push('<root>');

    const children = rootNode.getChildren();
    children.forEach((child) => {
      this.nodesToXML(child, xmlLines);
    });

    xmlLines.push('</root>');
    return xmlLines.join('\n');
  }

  /**
   * Recursively convert Lexical nodes to XML elements
   */
  private nodesToXML(node: any, lines: string[], indent: number = 1): void {
    const indentStr = ' '.repeat(indent * 2);
    const type = node.getType();
    const customWriters = this.litexmlService.getXMLWriters();

    const childLines: string[] = [];

    // Check if there's a custom writer for this node type
    if (customWriters[type]) {
      const writerOrWriters = customWriters[type];
      const writers = Array.isArray(writerOrWriters) ? writerOrWriters : [writerOrWriters];

      for (const writer of writers) {
        const handled = writer(node, this.ctx, indent, this.nodesToXML.bind(this));
        if (handled) {
          if ('lines' in handled) {
            lines.push(...handled.lines);
            return;
          }
          const attrs = this.buildXMLAttributes({
            id: idToChar(node.getKey()),
            ...handled.attributes,
          });
          const openTag = `${indentStr}<${handled.tagName}${attrs}>`;
          const closeTag = `</${handled.tagName}>`;
          if (handled.textContent) {
            lines.push(`${openTag}${handled.textContent}${closeTag}`);
          } else if ($isElementNode(node)) {
            const children = node.getChildren();
            children.forEach((child) => {
              this.nodesToXML(child, childLines, indent + 1);
            });
            lines.push(openTag, ...childLines, `${indentStr}${closeTag}`);
          } else {
            lines.push(openTag, `${indentStr}${closeTag}`);
          }
          return; // Custom writer handled it
        }
      }
    }

    if ($isElementNode(node)) {
      const children = node.getChildren();
      children.forEach((child) => {
        this.nodesToXML(child, childLines, indent);
      });
    }
    lines.push(...childLines);
  }

  /**
   * Build XML attribute string from attributes object
   */
  private buildXMLAttributes(attributes?: {
    [key: string]: string | number | undefined | null;
  }): string {
    if (!attributes || typeof attributes !== 'object') {
      return '';
    }

    return Object.entries(attributes)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => {
        const escapedValue = this.escapeXML(String(value));
        return ` ${key}="${escapedValue}"`;
      })
      .join('');
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(text: string): string {
    return text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
  }
}
