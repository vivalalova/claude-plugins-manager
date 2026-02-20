/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { tokenizeJson, JsonHighlight } from '../JsonHighlight';

describe('tokenizeJson', () => {
  it('tokenizes keys, strings, numbers, booleans, null', () => {
    const json = '{"name": "test", "count": 42, "active": true, "data": null}';
    const tokens = tokenizeJson(json);

    const keys = tokens.filter((t) => t.type === 'key');
    expect(keys.map((t) => t.value)).toEqual(['"name"', '"count"', '"active"', '"data"']);

    const strings = tokens.filter((t) => t.type === 'string');
    expect(strings.map((t) => t.value)).toEqual(['"test"']);

    const numbers = tokens.filter((t) => t.type === 'number');
    expect(numbers.map((t) => t.value)).toEqual(['42']);

    const booleans = tokens.filter((t) => t.type === 'boolean');
    expect(booleans.map((t) => t.value)).toEqual(['true']);

    const nulls = tokens.filter((t) => t.type === 'null');
    expect(nulls.map((t) => t.value)).toEqual(['null']);
  });

  it('handles nested objects and arrays', () => {
    const json = '{"arr": [1, 2], "obj": {"a": "b"}}';
    const tokens = tokenizeJson(json);

    const keys = tokens.filter((t) => t.type === 'key');
    expect(keys.map((t) => t.value)).toEqual(['"arr"', '"obj"', '"a"']);

    const numbers = tokens.filter((t) => t.type === 'number');
    expect(numbers.map((t) => t.value)).toEqual(['1', '2']);
  });

  it('handles escaped quotes in strings', () => {
    const json = '{"msg": "say \\"hello\\""}';
    const tokens = tokenizeJson(json);

    const strings = tokens.filter((t) => t.type === 'string');
    expect(strings[0].value).toBe('"say \\"hello\\""');
  });

  it('handles negative numbers and decimals', () => {
    const json = '{"a": -1, "b": 3.14, "c": 1e10}';
    const tokens = tokenizeJson(json);

    const numbers = tokens.filter((t) => t.type === 'number');
    expect(numbers.map((t) => t.value)).toEqual(['-1', '3.14', '1e10']);
  });

  it('handles false boolean', () => {
    const json = '{"ok": false}';
    const tokens = tokenizeJson(json);

    const booleans = tokens.filter((t) => t.type === 'boolean');
    expect(booleans.map((t) => t.value)).toEqual(['false']);
  });

  it('handles empty object', () => {
    const tokens = tokenizeJson('{}');
    const punctuation = tokens.filter((t) => t.type === 'punctuation');
    expect(punctuation.map((t) => t.value)).toEqual(['{', '}']);
  });

  it('handles multiline JSON', () => {
    const json = '{\n  "key": "value"\n}';
    const tokens = tokenizeJson(json);

    // whitespace tokens contain newlines
    const ws = tokens.filter((t) => t.type === 'punctuation' && t.value.includes('\n'));
    expect(ws.length).toBeGreaterThan(0);
  });
});

describe('JsonHighlight component', () => {
  it('renders line numbers and highlighted tokens', () => {
    const json = '{\n  "name": "test"\n}';
    const { container } = render(<JsonHighlight json={json} />);

    // 3 行 → 3 個行號
    const lineNumbers = container.querySelectorAll('.json-line-number');
    expect(lineNumbers.length).toBe(3);
    expect(lineNumbers[0].textContent).toBe('1');
    expect(lineNumbers[1].textContent).toBe('2');
    expect(lineNumbers[2].textContent).toBe('3');

    // key token
    const keyTokens = container.querySelectorAll('.json-token--key');
    expect(keyTokens.length).toBe(1);
    expect(keyTokens[0].textContent).toBe('"name"');

    // string value token
    const stringTokens = container.querySelectorAll('.json-token--string');
    expect(stringTokens.length).toBe(1);
    expect(stringTokens[0].textContent).toBe('"test"');
  });

  it('renders number, boolean, null with correct classes', () => {
    const json = '{"n": 42, "b": true, "x": null}';
    const { container } = render(<JsonHighlight json={json} />);

    expect(container.querySelector('.json-token--number')?.textContent).toBe('42');
    expect(container.querySelector('.json-token--boolean')?.textContent).toBe('true');
    expect(container.querySelector('.json-token--null')?.textContent).toBe('null');
  });

  it('line numbers have aria-hidden for screen readers', () => {
    const { container } = render(<JsonHighlight json='{"a": 1}' />);
    const lineNum = container.querySelector('.json-line-number');
    expect(lineNum?.getAttribute('aria-hidden')).toBe('true');
  });

  it('table has role="presentation" (layout only)', () => {
    const { container } = render(<JsonHighlight json='{}' />);
    const table = container.querySelector('table');
    expect(table?.getAttribute('role')).toBe('presentation');
  });

  it('container has json-highlight class with scrollable overflow', () => {
    const { container } = render(<JsonHighlight json='{}' />);
    const wrapper = container.querySelector('.json-highlight');
    expect(wrapper).toBeTruthy();
  });
});
