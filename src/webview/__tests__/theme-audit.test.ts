/**
 * CSS Theme Audit — 驗證 styles.css 使用 VSCode CSS variables，
 * 沒有 standalone hardcoded color 值（只允許 var() fallback）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const CSS_PATH = join(__dirname, '..', 'styles.css');
const css = readFileSync(CSS_PATH, 'utf-8');

/** 移除 CSS comments */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** 取得所有 CSS 宣告（property: value 對） */
function extractDeclarations(src: string): Array<{ line: number; prop: string; value: string }> {
  const results: Array<{ line: number; prop: string; value: string }> = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\s*([\w-]+)\s*:\s*(.+?)\s*;?\s*$/);
    if (match) {
      results.push({ line: i + 1, prop: match[1], value: match[2] });
    }
  }
  return results;
}

/** 色彩相關 CSS properties */
const COLOR_PROPS = new Set([
  'color', 'background', 'background-color', 'border-color',
  'border', 'border-top', 'border-bottom', 'border-left', 'border-right',
  'outline', 'outline-color', 'box-shadow', 'text-shadow',
  'text-decoration-color', 'caret-color', 'fill', 'stroke',
]);

/** 是否包含 standalone hex 或 rgb/rgba（不在 var() fallback 裡） */
function hasStandaloneHardcodedColor(value: string): boolean {
  // 移除 var(..., fallback) 中的 fallback
  const withoutVarFallbacks = value.replace(/var\([^)]+\)/g, '');
  // 移除 color-mix() 中引用 var 的部分
  const withoutColorMix = withoutVarFallbacks.replace(/color-mix\([^)]+\)/g, '');
  // 檢查是否有 standalone #hex 或 rgb()/rgba()
  return /(?:^|\s)#[0-9a-fA-F]{3,8}(?:\s|$|,|;)/.test(withoutColorMix) ||
         /(?:^|\s)rgba?\(/.test(withoutColorMix);
}

describe('CSS Theme Audit', () => {
  const stripped = stripComments(css);
  const decls = extractDeclarations(stripped);

  it('styles.css 使用 --vscode-* CSS variables', () => {
    expect(css).toContain('--vscode-');
  });

  it('色彩宣告使用 var() 或 color-mix()，不含 standalone hardcoded hex/rgb', () => {
    const colorDecls = decls.filter((d) => COLOR_PROPS.has(d.prop));
    const violations: string[] = [];
    for (const d of colorDecls) {
      // 允許 'transparent', 'inherit', 'none', 'currentColor' 等 CSS 關鍵字
      if (/^(transparent|inherit|none|currentColor|unset|initial)$/.test(d.value.trim())) continue;
      if (hasStandaloneHardcodedColor(d.value)) {
        violations.push(`L${d.line}: ${d.prop}: ${d.value}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('使用 color-mix() 而非 hardcoded rgba 作為 badge 背景', () => {
    // scope-badge、badge-enabled、badge-disabled 應使用 color-mix
    const badgeRules = stripped.match(/\.(?:scope-badge|badge-enabled|badge-disabled)[^{]*\{[^}]*\}/g) ?? [];
    for (const rule of badgeRules) {
      if (rule.includes('background')) {
        expect(rule).toMatch(/color-mix|var\(/);
      }
    }
  });

  it('沒有 body.vscode-light 覆寫 scope badge 顏色', () => {
    expect(css).not.toMatch(/body\.vscode-light\s+\.scope-badge/);
  });

  it('沒有 body.vscode-light 覆寫 badge-enabled 顏色', () => {
    expect(css).not.toMatch(/body\.vscode-light\s+\.badge-enabled/);
  });

  it('沒有 body.vscode-light 覆寫 badge-update 顏色', () => {
    expect(css).not.toMatch(/body\.vscode-light\s+\.badge-update/);
  });

  it('沒有 body.vscode-light 覆寫 JSON token 顏色', () => {
    expect(css).not.toMatch(/body\.vscode-light\s+\.json-token/);
  });
});
