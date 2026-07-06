const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h3",
]);

const TAG_ALIASES: Record<string, string> = {
  b: "strong",
  i: "em",
  div: "p",
  h1: "h3",
  h2: "h3",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeBasicEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
}

export function sanitizeRichText(input: string) {
  const source = input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/&nbsp;/gi, " ");

  let output = "";
  let lastIndex = 0;
  const tagRe = /<\/?[^>]+>/g;

  for (const match of source.matchAll(tagRe)) {
    const index = match.index ?? lastIndex;
    output += escapeHtml(source.slice(lastIndex, index));

    const rawTag = match[0];
    const parsed = rawTag.match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
    if (parsed) {
      const closing = parsed[1] === "/";
      const rawName = parsed[2].toLowerCase();
      const tag = TAG_ALIASES[rawName] ?? rawName;

      if (ALLOWED_TAGS.has(tag)) {
        if (tag === "br") {
          output += "<br />";
        } else {
          output += closing ? `</${tag}>` : `<${tag}>`;
        }
      }
    }

    lastIndex = index + rawTag.length;
  }

  output += escapeHtml(source.slice(lastIndex));
  return output.trim();
}

export function plainTextToRichHtml(input: string) {
  const paragraphs = input
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split(/\n/)
        .map((line) => escapeHtml(line))
        .join("<br />"),
    )
    .filter((paragraph) => paragraph.trim().length > 0);

  return paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
}

export function isRichTextHtml(input: string) {
  return /<\/?(p|br|strong|b|em|i|u|s|ul|ol|li|blockquote|h1|h2|h3|div)\b/i.test(
    input,
  );
}

export function descriptionToHtml(input: string | null | undefined) {
  const value = input?.trim() ?? "";
  if (!value) return "";
  return isRichTextHtml(value) ? sanitizeRichText(value) : plainTextToRichHtml(value);
}

export function richTextToPlainText(input: string | null | undefined) {
  const html = descriptionToHtml(input);
  return decodeBasicEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|h3|blockquote|li)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n"),
  ).trim();
}

export function hasRichTextContent(input: string | null | undefined) {
  return richTextToPlainText(input).length > 0;
}

export function prepareRichTextForStorage(input: string) {
  const html = sanitizeRichText(input);
  return hasRichTextContent(html) ? html : "";
}
