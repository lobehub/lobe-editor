/* eslint-disable no-redeclare */
/* eslint-disable @typescript-eslint/no-redeclare */
import EventEmitter from 'eventemitter3';
import type { LexicalEditor } from 'lexical';
import type { ReactNode } from 'react';

import { genServiceId } from '@/editor-kernel';
import { IServiceID } from '@/types';

import type { LinkNode } from '../node/LinkNode';

export interface SchemaLinkRendererProps {
  editor: LexicalEditor;
  node: LinkNode;
  rel: null | string;
  target: null | string;
  text: string;
  title: null | string;
  url: string;
}

export type SchemaLinkRenderer = (props: SchemaLinkRendererProps) => ReactNode;

export interface SchemaLinkRendererConfig {
  protocol: string;
  render: SchemaLinkRenderer;
}

export interface ILinkService {
  getAllowedProtocols(): Set<string>;
  getSchemaLinkRenderer(url: string): SchemaLinkRenderer | null;
  setLinkToolbar(enable: boolean): void;
}

export const ILinkService: IServiceID<ILinkService> = genServiceId<ILinkService>('LinkService');

export class LinkService extends EventEmitter<'linkToolbarChange'> implements ILinkService {
  private _enableLinkToolbar: boolean = true;
  private _allowedProtocols = new Set(['http:', 'https:', 'mailto:', 'sms:', 'tel:']);
  private _schemaLinkRenderers = new Map<string, SchemaLinkRenderer>();

  public get enableLinkToolbar(): boolean {
    return this._enableLinkToolbar;
  }

  getAllowedProtocols(): Set<string> {
    return this._allowedProtocols;
  }

  getSchemaLinkRenderer(url: string): SchemaLinkRenderer | null {
    try {
      const { protocol } = new URL(url);
      return this._schemaLinkRenderers.get(protocol) || null;
    } catch {
      return null;
    }
  }

  setAllowedProtocols(protocols: string[]): void {
    this._allowedProtocols = new Set(protocols.map(normalizeProtocol));
  }

  setSchemaLinkRenderers(renderers: SchemaLinkRendererConfig[] = []): void {
    this._schemaLinkRenderers = new Map(
      renderers.map(({ protocol, render }) => [normalizeProtocol(protocol), render]),
    );
  }

  setLinkToolbar(enable: boolean): void {
    this._enableLinkToolbar = enable;
    this.emit('linkToolbarChange', enable);
  }
}

function normalizeProtocol(protocol: string): string {
  const protocolName = protocol.split(':')[0];
  return `${protocolName}:`;
}
