/** 解析 markdown frontmatter（YAML-like key: value） */
export function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/.exec(content);
  if (!match) return { frontmatter: {}, body: content.trim() };

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key) frontmatter[key] = value;
  }

  return { frontmatter, body: match[2].trim() };
}
