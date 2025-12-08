import type { LexicalNode } from 'lexical';

import { genServiceId } from '@/editor-kernel';

/**
 * XML Reader function type - converts XML element to Lexical node
 */
export type XMLReaderFunc = (xmlElement: Element, children: any[]) => any | any[] | false;

/**
 * XML Writer function type - converts Lexical node to XML string
 */
export type XMLWriterFunc = (
  node: LexicalNode,
  ctx: IWriterContext,
  indent: number,
) => IXmlNode | false; // return IXmlNode if handled, false to continue with default

/**
 * Record of XML readers indexed by tag name
 */
export type XMLReaderRecord = {
  [tagName: string]: XMLReaderFunc | XMLReaderFunc[];
};

/**
 * Record of XML writers indexed by node type
 */
export type XMLWriterRecord = {
  [nodeType: string]: XMLWriterFunc | XMLWriterFunc[];
};

export interface IXmlNode {
  attributes: { [key: string]: string };
  children?: IXmlNode[];
  tagName: string;
  textContent?: string;
}

export interface IWriterContext {
  createXmlNode(
    tagName: string,
    attributes?: { [key: string]: string },
    textContent?: string,
  ): IXmlNode;
}

/**
 * ILitexmlService - Service interface for extending Litexml plugin
 * Allows other plugins to register custom XML readers and writers
 */
export interface ILitexmlService {
  /**
   * Get all registered XML readers
   */
  getXMLReaders(): XMLReaderRecord;

  /**
   * Get all registered XML writers
   */
  getXMLWriters(): XMLWriterRecord;

  /**
   * Check if a reader is registered for a tag
   */
  hasXMLReader(tagName: string): boolean;

  /**
   * Check if a writer is registered for a node type
   */
  hasXMLWriter(nodeType: string): boolean;

  /**
   * Register a custom XML reader for a specific tag name
   * @param tagName - XML tag name to handle (case-insensitive)
   * @param reader - Function that converts XML element to Lexical node
   */
  registerXMLReader(tagName: string, reader: XMLReaderFunc): void;

  /**
   * Register a custom XML writer for a specific Lexical node type
   * @param nodeType - Lexical node type to handle
   * @param writer - Function that converts Lexical node to XML string
   */
  registerXMLWriter(nodeType: string, writer: XMLWriterFunc): void;
}

/**
 * Service ID for Litexml service
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare, no-redeclare
export const ILitexmlService = genServiceId<ILitexmlService>('ILitexmlService');

/**
 * Default implementation of ILitexmlService
 */
export class LitexmlService implements ILitexmlService {
  private readers: XMLReaderRecord = {};
  private writers: XMLWriterRecord = {};

  registerXMLReader(tagName: string, reader: XMLReaderFunc): void {
    const key = tagName.toLowerCase();
    if (this.readers[key]) {
      // If reader already exists, convert to array
      const existing = this.readers[key];
      this.readers[key] = Array.isArray(existing) ? [...existing, reader] : [existing, reader];
    } else {
      this.readers[key] = reader;
    }
  }

  registerXMLWriter(nodeType: string, writer: XMLWriterFunc): void {
    if (this.writers[nodeType]) {
      // If writer already exists, convert to array
      const existing = this.writers[nodeType];
      this.writers[nodeType] = Array.isArray(existing) ? [...existing, writer] : [existing, writer];
    } else {
      this.writers[nodeType] = writer;
    }
  }

  getXMLReaders(): XMLReaderRecord {
    return { ...this.readers };
  }

  getXMLWriters(): XMLWriterRecord {
    return { ...this.writers };
  }

  hasXMLReader(tagName: string): boolean {
    return !!this.readers[tagName.toLowerCase()];
  }

  hasXMLWriter(nodeType: string): boolean {
    return !!this.writers[nodeType];
  }
}
