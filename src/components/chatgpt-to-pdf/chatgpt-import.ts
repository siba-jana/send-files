/**
 * Helper to parse and import .md, .markdown, and .txt files cleanly.
 * Automatically extracts YAML frontmatter (title, author, date, model),
 * detects leading H1 headings, and normalizes file names.
 */
export interface ImportedMarkdownResult {
  title?: string;
  subtitle?: string;
  author?: string;
  date?: string;
  model?: string;
  content: string;
  fileName: string;
}

export function parseMarkdownFile(
  raw: string,
  fileName: string
): ImportedMarkdownResult {
  let content = raw;
  let title = "";
  let subtitle = "";
  let author = "";
  let date = "";
  let model = "";

  // 1. Check for YAML Frontmatter (e.g. --- title: ... ---)
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
  const match = raw.match(frontmatterRegex);

  if (match) {
    const yamlBlock = match[1];
    content = raw.replace(match[0], "");

    const lines = yamlBlock.split(/\r?\n/);
    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > -1) {
        const key = line.slice(0, colonIdx).trim().toLowerCase();
        const val = line
          .slice(colonIdx + 1)
          .trim()
          .replace(/^['"](.*)['"]$/, "$1");

        if (key === "title") title = val;
        else if (key === "subtitle" || key === "description") subtitle = val;
        else if (key === "author") author = val;
        else if (key === "date") date = val;
        else if (key === "model") model = val;
      }
    }
  }

  // 2. If no title in frontmatter, look for first `# Heading` in content
  if (!title) {
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      title = h1Match[1].trim();
    } else {
      // 3. Fallback to clean filename: "my_cool_chat.md" -> "My Cool Chat"
      const cleanName = fileName
        .replace(/\.(md|markdown|mdown|mkd|txt)$/i, "")
        .replace(/[-_]+/g, " ")
        .trim();
      if (cleanName) {
        title = cleanName
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      }
    }
  }

  return {
    title,
    subtitle,
    author,
    date,
    model,
    content: content.trim(),
    fileName,
  };
}

