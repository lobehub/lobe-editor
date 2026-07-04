/* eslint-disable no-redeclare */
/* eslint-disable @typescript-eslint/no-redeclare */
/* eslint-disable @typescript-eslint/no-use-before-define */
import EventEmitter from 'eventemitter3';
import type { LexicalEditor, LexicalNode } from 'lexical';

import { genServiceId } from '@/editor-kernel';
import { IServiceID } from '@/types';

import type { LinkCardNode } from '../node/LinkCardNode';
import type { LinkIframeNode } from '../node/LinkIframeNode';
import type { LinkNode } from '../node/LinkNode';
import type { SchemaNode } from '../node/SchemaNode';

export interface ParsedSchemaUrl {
  hash: string;
  host: string;
  params: Record<string, string>;
  pathname: string;
  protocol: string;
  raw: string;
  search: string;
}

export interface LinkRuleContext {
  editor: LexicalEditor;
  text: string;
  title: string;
}

export interface LinkCardPayload {
  description?: string;
  icon?: string;
  openTarget?: null | string;
  title?: string;
  url?: string;
}

export interface LinkIframePayload {
  src?: string;
  title?: string;
  url?: string;
}

export interface SchemaPayload {
  payload?: unknown;
  schemaType?: string;
  title?: string;
  url?: string;
}

export interface LinkEmbedRule {
  allowCard?: boolean;
  allowIframe?: boolean;
  getCardPayload?: (url: string, context: LinkRuleContext) => LinkCardPayload;
  getIframePayload?: (url: string, context: LinkRuleContext) => LinkIframePayload;
  id: string;
  match: (url: string, context: LinkRuleContext) => boolean;
}

export interface SchemaRule {
  id: string;
  match: (url: string, context: LinkRuleContext & { schema: ParsedSchemaUrl | null }) => boolean;
  parse?: (url: string, schema: ParsedSchemaUrl | null) => SchemaPayload | unknown;
}

export interface LinkLabels {
  convertToCard: string;
  convertToIframe: string;
  convertToLink: string;
  convertToSchema: string;
}

export type LinkToolbarNode = LinkNode | LinkCardNode | LinkIframeNode | SchemaNode;

export interface LinkToolbarActionContext {
  editor: LexicalEditor;
  node: LinkToolbarNode;
}

export interface LinkToolbarAction {
  icon?: unknown;
  key: string;
  label: string;
  onClick: (context: LinkToolbarActionContext) => void;
  visible?: (context: LinkToolbarActionContext) => boolean;
}

/** @deprecated Use schemaRules with SchemaNode instead. React rendering lives in the React plugin. */
export interface SchemaLinkRendererConfig {
  protocol: string;
}

export interface LinkServiceConfig {
  allowedProtocols?: string[];
  labels?: Partial<LinkLabels>;
  linkEmbedRules?: LinkEmbedRule[];
  schemaLinkRenderers?: SchemaLinkRendererConfig[];
  schemaRules?: SchemaRule[];
  toolbarActions?: LinkToolbarAction[];
}

export interface ILinkService {
  getAllowedProtocols(): Set<string>;
  getEmbedRule(url: string, context: LinkRuleContext): LinkEmbedRule | null;
  getLabels(): LinkLabels;
  getSchemaRule(
    url: string,
    context: LinkRuleContext & { schema?: ParsedSchemaUrl | null },
  ): SchemaRule | null;
  getToolbarActions(context: LinkToolbarActionContext): LinkToolbarAction[];
  hasSchemaLinkRenderer(url: string): boolean;
  parseSchemaUrl(url: string): ParsedSchemaUrl | null;
  restoreLinkToolbar(token: symbol): void;
  setLinkToolbar(enable: boolean): void;
  suppressLinkToolbar(reason?: string): symbol;
  updateConfig(config?: LinkServiceConfig): void;
}

export const ILinkService: IServiceID<ILinkService> = genServiceId<ILinkService>('LinkService');

const DEFAULT_LABELS: LinkLabels = {
  convertToCard: 'Convert to card',
  convertToIframe: 'Convert to iframe',
  convertToLink: 'Convert to link',
  convertToSchema: 'Convert to schema',
};

class LinkProtocolPolicy {
  private allowedProtocols = new Set(['http:', 'https:', 'mailto:', 'sms:', 'tel:']);

  getAllowedProtocols(): Set<string> {
    return this.allowedProtocols;
  }

  setAllowedProtocols(protocols: string[]): void {
    this.allowedProtocols = new Set(protocols.map(normalizeProtocol));
  }
}

class LinkRuleRegistry {
  private embedRules: LinkEmbedRule[] = [];
  private schemaRules: SchemaRule[] = [];

  getEmbedRule(url: string, context: LinkRuleContext): LinkEmbedRule | null {
    return this.embedRules.find((rule) => rule.match(url, context)) || null;
  }

  getSchemaRule(
    url: string,
    context: LinkRuleContext & { schema?: ParsedSchemaUrl | null },
    parseSchemaUrl: (url: string) => ParsedSchemaUrl | null,
  ): SchemaRule | null {
    const schema = context.schema === undefined ? parseSchemaUrl(url) : context.schema;
    return this.schemaRules.find((rule) => rule.match(url, { ...context, schema })) || null;
  }

  getSchemaRuleById(schemaType: string): SchemaRule | null {
    return this.schemaRules.find((rule) => rule.id === schemaType) || null;
  }

  setEmbedRules(rules: LinkEmbedRule[] = []): void {
    this.embedRules = rules;
  }

  setSchemaRules(rules: SchemaRule[] = []): void {
    this.schemaRules = rules;
  }
}

class LegacySchemaLinkRegistry {
  private protocols = new Set<string>();

  hasSchemaLinkRenderer(url: string): boolean {
    try {
      const { protocol } = new URL(url);
      return this.protocols.has(protocol);
    } catch {
      return false;
    }
  }

  setSchemaLinkRenderers(renderers: SchemaLinkRendererConfig[] = []): void {
    this.protocols = new Set(renderers.map(({ protocol }) => normalizeProtocol(protocol)));
  }
}

class LinkToolbarController {
  private baseEnabled = true;
  private labels: LinkLabels = DEFAULT_LABELS;
  private toolbarActions: LinkToolbarAction[] = [];
  private toolbarSuppressions = new Set<symbol>();

  get enabled(): boolean {
    return this.baseEnabled && this.toolbarSuppressions.size === 0;
  }

  getLabels(): LinkLabels {
    return this.labels;
  }

  getToolbarActions(context: LinkToolbarActionContext): LinkToolbarAction[] {
    return this.toolbarActions.filter((action) => action.visible?.(context) ?? true);
  }

  setLabels(labels?: Partial<LinkLabels>): void {
    this.labels = { ...DEFAULT_LABELS, ...labels };
  }

  setToolbarActions(actions: LinkToolbarAction[] = []): void {
    this.toolbarActions = actions;
  }

  setEnabled(enable: boolean): boolean {
    const previousEnabled = this.enabled;
    this.baseEnabled = enable;
    return previousEnabled !== this.enabled;
  }

  suppress(reason = 'unknown'): { changed: boolean; token: symbol } {
    const previousEnabled = this.enabled;
    const token = Symbol(reason);
    this.toolbarSuppressions.add(token);
    return { changed: previousEnabled !== this.enabled, token };
  }

  restore(token: symbol): boolean {
    const previousEnabled = this.enabled;
    if (!this.toolbarSuppressions.delete(token)) return false;
    return previousEnabled !== this.enabled;
  }
}

export class LinkService extends EventEmitter<'linkToolbarChange'> implements ILinkService {
  private protocolPolicy = new LinkProtocolPolicy();
  private legacySchemaLinkRegistry = new LegacySchemaLinkRegistry();
  private ruleRegistry = new LinkRuleRegistry();
  private toolbarController = new LinkToolbarController();

  public get enableLinkToolbar(): boolean {
    return this.toolbarController.enabled;
  }

  getAllowedProtocols(): Set<string> {
    return this.protocolPolicy.getAllowedProtocols();
  }

  getEmbedRule(url: string, context: LinkRuleContext): LinkEmbedRule | null {
    return this.ruleRegistry.getEmbedRule(url, context);
  }

  getLabels(): LinkLabels {
    return this.toolbarController.getLabels();
  }

  hasSchemaLinkRenderer(url: string): boolean {
    return this.legacySchemaLinkRegistry.hasSchemaLinkRenderer(url);
  }

  getSchemaRule(
    url: string,
    context: LinkRuleContext & { schema?: ParsedSchemaUrl | null },
  ): SchemaRule | null {
    return this.ruleRegistry.getSchemaRule(url, context, (url) => this.parseSchemaUrl(url));
  }

  getToolbarActions(context: LinkToolbarActionContext): LinkToolbarAction[] {
    return this.toolbarController.getToolbarActions(context);
  }

  parseSchemaUrl(url: string): ParsedSchemaUrl | null {
    try {
      const parsedUrl = new URL(url);
      return {
        hash: parsedUrl.hash,
        host: parsedUrl.host,
        params: Object.fromEntries(parsedUrl.searchParams.entries()),
        pathname: parsedUrl.pathname,
        protocol: parsedUrl.protocol,
        raw: url,
        search: parsedUrl.search,
      };
    } catch {
      return null;
    }
  }

  updateConfig(config?: LinkServiceConfig): void {
    this.setAllowedProtocols([
      'http:',
      'https:',
      'mailto:',
      'sms:',
      'tel:',
      ...(config?.schemaLinkRenderers?.map(({ protocol }) => protocol) || []),
      ...(config?.allowedProtocols || []),
    ]);
    this.setEmbedRules(config?.linkEmbedRules);
    this.setLabels(config?.labels);
    this.setSchemaLinkRenderers(config?.schemaLinkRenderers);
    this.setSchemaRules([
      ...(config?.schemaRules || []),
      ...createLegacySchemaRules(config?.schemaLinkRenderers),
    ]);
    this.setToolbarActions(config?.toolbarActions);
  }

  setAllowedProtocols(protocols: string[]): void {
    this.protocolPolicy.setAllowedProtocols(protocols);
  }

  setEmbedRules(rules: LinkEmbedRule[] = []): void {
    this.ruleRegistry.setEmbedRules(rules);
  }

  setLabels(labels?: Partial<LinkLabels>): void {
    this.toolbarController.setLabels(labels);
  }

  setSchemaLinkRenderers(renderers: SchemaLinkRendererConfig[] = []): void {
    this.legacySchemaLinkRegistry.setSchemaLinkRenderers(renderers);
  }

  setSchemaRules(rules: SchemaRule[] = []): void {
    this.ruleRegistry.setSchemaRules(rules);
  }

  setToolbarActions(actions: LinkToolbarAction[] = []): void {
    this.toolbarController.setToolbarActions(actions);
  }

  setLinkToolbar(enable: boolean): void {
    if (this.toolbarController.setEnabled(enable)) {
      this.emit('linkToolbarChange', enable);
    }
  }

  suppressLinkToolbar(reason = 'unknown'): symbol {
    const { changed, token } = this.toolbarController.suppress(reason);
    if (changed) this.emit('linkToolbarChange', this.toolbarController.enabled);
    return token;
  }

  restoreLinkToolbar(token: symbol): void {
    if (this.toolbarController.restore(token)) {
      this.emit('linkToolbarChange', this.toolbarController.enabled);
    }
  }
}

export function normalizeProtocol(protocol: string): string {
  const protocolName = protocol.split(':')[0];
  return `${protocolName}:`;
}

export function createLegacySchemaRules(renderers: SchemaLinkRendererConfig[] = []): SchemaRule[] {
  return renderers.map(({ protocol }) => {
    const normalizedProtocol = normalizeProtocol(protocol);
    return {
      id: normalizedProtocol.replace(':', ''),
      match: (url) => {
        try {
          return new URL(url).protocol === normalizedProtocol;
        } catch {
          return false;
        }
      },
    };
  });
}

export function getNodeUrl(node: LexicalNode): string {
  const maybeUrlNode = node as LexicalNode & { getURL?: () => string };
  if (typeof maybeUrlNode.getURL === 'function') {
    return maybeUrlNode.getURL();
  }
  return '';
}

export function getNodeTitle(node: LexicalNode): string {
  const maybeTitleNode = node as LexicalNode & { getTitle?: () => null | string };
  if (typeof maybeTitleNode.getTitle === 'function') {
    return maybeTitleNode.getTitle() || getNodeUrl(node);
  }
  const maybeTextNode = node as LexicalNode & { getTextContent?: () => string };
  if (typeof maybeTextNode.getTextContent === 'function') {
    return maybeTextNode.getTextContent() || getNodeUrl(node);
  }
  return getNodeUrl(node);
}
