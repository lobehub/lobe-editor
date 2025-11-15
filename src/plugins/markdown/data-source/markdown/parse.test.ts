import { IS_BOLD } from 'lexical';
import { Strong } from 'mdast';
import { describe, expect, it } from 'vitest';

import { INodeHelper } from '@/editor-kernel/inode/helper';

import { parseMarkdownToLexical } from './parse';

describe('Markdown to Lexical Conversion', () => {
  it('should convert a simple markdown string to Lexical format', () => {
    const markdown = 'This is a **bold** text.';
    const lexical = parseMarkdownToLexical(markdown, {
      strong: (node: Strong, children) => {
        return children.map((child) => {
          if (INodeHelper.isTextNode(child)) {
            child.format = (child.format || 0) | IS_BOLD;
          }
          return child;
        });
      },
    });

    expect(lexical.children.length).toEqual(1);
    expect(lexical.children[0].type).toEqual('paragraph');
    // @ts-expect-error not error
    expect(lexical.children[0].children.length).toEqual(3);
    // @ts-expect-error not error
    expect(INodeHelper.isTextNode(lexical.children[0]?.children?.[1])).toBe(true);
    // @ts-expect-error not error
    expect(lexical.children[0]?.children?.[1]?.format).toBe(1);
  });

  it('should work html node', () => {
    const markdown = 'This is a <b>bold</b> text.';
    const lexical = parseMarkdownToLexical(markdown, {
      html: (node, children) => {
        if (node.value === '<b>') {
          return children.map((child) => {
            if (INodeHelper.isTextNode(child)) {
              child.format = (child.format || 0) | IS_BOLD;
            }
            return child;
          });
        }
        return false;
      },
    });

    expect(lexical.children.length).toEqual(1);
    expect(lexical.children[0].type).toEqual('paragraph');
    // @ts-expect-error not error
    expect(lexical.children[0].children.length).toEqual(3);
    // @ts-expect-error not error
    expect(INodeHelper.isTextNode(lexical.children[0]?.children?.[1])).toBe(true);
    // @ts-expect-error not error
    expect(lexical.children[0]?.children?.[1]?.format).toBe(1);
  });

  it('should work html mix markdown', () => {
    const markdown = 'This is a <b>**bold**</b> text.';
    const lexical = parseMarkdownToLexical(markdown, {
      html: (node, children) => {
        if (node.value === '<b>') {
          return children;
        }
        return false;
      },
      strong: (node: Strong, children) => {
        return children.map((child) => {
          if (INodeHelper.isTextNode(child)) {
            child.format = (child.format || 0) | IS_BOLD;
          }
          return child;
        });
      },
    });

    expect(lexical.children.length).toEqual(1);
    expect(lexical.children[0].type).toEqual('paragraph');
    // @ts-expect-error not error
    expect(lexical.children[0].children.length).toEqual(3);
    // @ts-expect-error not error
    expect(INodeHelper.isTextNode(lexical.children[0]?.children?.[1])).toBe(true);
    // @ts-expect-error not error
    expect(lexical.children[0]?.children?.[1]?.format).toBe(1);
  });

  it('should fallback list', () => {
    const markdown = '* asd\n* 123\n';
    const lexical = parseMarkdownToLexical(markdown, {});

    expect(lexical.children.length).toEqual(2);
    // @ts-expect-error not error
    expect(lexical.children[0].children.length).toEqual(1);
    // @ts-expect-error not error
    expect(lexical.children[0].children[0].text).toEqual('asd');
  });

  it('should ignore html comment', () => {
    const markdown = 'This is a <!-- comment --> text.';
    const lexical = parseMarkdownToLexical(markdown, {});
    expect(lexical.children.length).toEqual(1);

    // @ts-expect-error not error
    expect(lexical.children[0].children.length).toEqual(2);

    // @ts-expect-error not error
    expect(lexical.children[0].children[0].text).toEqual('This is a ');
    // @ts-expect-error not error
    expect(lexical.children[0].children[1].text).toEqual(' text.');
  });

  it('should output origin xml no reader', () => {
    const markdown =
      '不存在从 "int" 转换到 "std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char>>" 的适当构造函数';
    const lexical = parseMarkdownToLexical(markdown, {});
    expect(lexical.children.length).toEqual(1);

    // @ts-expect-error not error
    expect(lexical.children[0].children.length).toEqual(5);

    // @ts-expect-error not error
    expect(lexical.children[0].children[0].text).toEqual(
      '不存在从 "int" 转换到 "std::__cxx11::basic_string<char, std::char_traits',
    );
    // @ts-expect-error not error
    expect(lexical.children[0].children[1].text).toEqual('<char>');
    // @ts-expect-error not error
    expect(lexical.children[0].children[2].text).toEqual(', std::allocator');
    // @ts-expect-error not error
    expect(lexical.children[0].children[3].text).toEqual('<char>');
    // @ts-expect-error not error
    expect(lexical.children[0].children[4].text).toEqual('>" 的适当构造函数');
  });

  it('should output origin xml no reader case 2', () => {
    const markdown = 'sql<number>`COALESCE(SUM(${plugins.installCount}), 0)`';
    const lexical = parseMarkdownToLexical(markdown, {
      inlineCode: (node, children) => {
        return [INodeHelper.createTextNode('`' + node.value + '`')];
      },
    });

    expect(lexical.children.length).toEqual(1);

    // @ts-expect-error not error
    expect(lexical.children[0].children.length).toEqual(3);

    // @ts-expect-error not error
    expect(lexical.children[0].children[0].text).toEqual('sql');
    // @ts-expect-error not error
    expect(lexical.children[0].children[1].text).toEqual('<number>');
    // @ts-expect-error not error
    expect(lexical.children[0].children[2].text).toEqual(
      '`COALESCE(SUM(${plugins.installCount}), 0)`',
    );
  });
});
