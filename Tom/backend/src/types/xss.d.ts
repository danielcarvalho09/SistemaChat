/**
 * Declaração de tipos para biblioteca xss
 * A biblioteca xss não possui tipos TypeScript nativos
 */

declare module 'xss' {
  interface IFilterXSSOptions {
    whiteList?: Record<string, string[]>;
    stripIgnoreTag?: boolean;
    stripIgnoreTagBody?: string[];
    onTag?: (tag: string, html: string, options: any) => string | void;
    onTagAttr?: (tag: string, name: string, value: string) => string | void;
    onIgnoreTag?: (tag: string, html: string, options: any) => string | void;
    onIgnoreTagAttr?: (tag: string, name: string, value: string) => string | void;
    safeAttrValue?: (tag: string, name: string, value: string) => string;
    escapeHtml?: (html: string) => string;
    stripBlankChar?: boolean;
    allowCommentTag?: boolean;
    css?: any;
  }

  function xss(html: string, options?: IFilterXSSOptions): string;

  export = xss;
}

