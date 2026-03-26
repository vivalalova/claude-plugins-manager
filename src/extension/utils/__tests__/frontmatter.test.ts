import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../frontmatter';

describe('parseFrontmatter', () => {
  it('完整 frontmatter + body', () => {
    const content = `---
name: lint
description: Run lint checks
model: sonnet
---

# Heading

Body text.`;

    const result = parseFrontmatter(content);

    expect(result.frontmatter).toEqual({
      name: 'lint',
      description: 'Run lint checks',
      model: 'sonnet',
    });
    expect(result.body).toBe('# Heading\n\nBody text.');
  });

  it('無 frontmatter → 整份內容為 body', () => {
    const result = parseFrontmatter('Just plain text.');
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe('Just plain text.');
  });

  it('空字串', () => {
    const result = parseFrontmatter('');
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe('');
  });

  it('value 含冒號（如 URL）不會被截斷', () => {
    const content = `---
repo: https://github.com/owner/repo
---

body`;

    const result = parseFrontmatter(content);
    expect(result.frontmatter.repo).toBe('https://github.com/owner/repo');
  });

  it('key 前後空白被 trim', () => {
    const content = `---
  name  :  spaced value
---

x`;

    const result = parseFrontmatter(content);
    expect(result.frontmatter.name).toBe('spaced value');
  });

  it('空 key 行被忽略', () => {
    const content = `---
: orphan value
name: ok
---

body`;

    const result = parseFrontmatter(content);
    expect(result.frontmatter).toEqual({ name: 'ok' });
  });

  it('無冒號的行被忽略', () => {
    const content = `---
name: lint
this line has no colon
model: sonnet
---

body`;

    const result = parseFrontmatter(content);
    expect(result.frontmatter).toEqual({ name: 'lint', model: 'sonnet' });
  });

  it('只有 frontmatter 無 body', () => {
    const content = `---
name: test
---

`;

    const result = parseFrontmatter(content);
    expect(result.frontmatter).toEqual({ name: 'test' });
    expect(result.body).toBe('');
  });

  it('allowed-tools 逗號分隔值完整保留', () => {
    const content = `---
allowed-tools: Read, Write, Bash
---

body`;

    const result = parseFrontmatter(content);
    expect(result.frontmatter['allowed-tools']).toBe('Read, Write, Bash');
  });
});
