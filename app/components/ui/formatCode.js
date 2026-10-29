// Small dependency-free formatter for Widget Studio templates (HTML) and scoped CSS.
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

export function formatHtml(source = "", indent = "  ") {
  const parts = String(source).replace(/>\s+</g, "><").trim().split(/(<[^>]+>)/).map((part) => part.trim()).filter(Boolean);
  let depth = 0;
  const lines = [];
  for (const part of parts) {
    if (part.startsWith("</")) {
      depth = Math.max(0, depth - 1);
      lines.push(indent.repeat(depth) + part);
    } else if (part.startsWith("<")) {
      lines.push(indent.repeat(depth) + part);
      const tag = (part.match(/^<\s*([a-zA-Z0-9-]+)/) || [])[1]?.toLowerCase();
      if (tag && !VOID.has(tag) && !part.endsWith("/>") && !part.startsWith("<!")) depth += 1;
    } else {
      lines.push(indent.repeat(depth) + part);
    }
  }
  // Keep short element/text/closing triples on one line: <p>Text</p>
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const open = lines[i]; const text = lines[i + 1]; const close = lines[i + 2];
    if (text !== undefined && close !== undefined && /^\s*<[a-zA-Z][^>]*>$/.test(open) && !/\/>$/.test(open) && !/^\s*</.test(text) && /^\s*<\//.test(close) && (open.trim() + text.trim() + close.trim()).length < 100) {
      out.push(open + text.trim() + close.trim());
      i += 2;
    } else out.push(open);
  }
  return out.join("\n");
}

export function formatCss(source = "", indent = "  ") {
  const text = String(source).replace(/\s+/g, " ").replace(/\s*([{};])\s*/g, "$1").trim();
  let depth = 0;
  let out = "";
  for (const char of text) {
    if (char === "{") { out += " {\n"; depth += 1; out += indent.repeat(depth); }
    else if (char === ";") { out += ";\n" + indent.repeat(depth); }
    else if (char === "}") { depth = Math.max(0, depth - 1); out = out.replace(/\s*$/, "") + "\n" + indent.repeat(depth) + "}\n\n" + indent.repeat(depth); }
    else out += char;
  }
  const tidy = out.replace(/\n[ \t]*\n(?=[ \t]*})/g, "\n").replace(/\n{3,}/g, "\n\n").trim().split("\n").map((line) => {
    // Declarations: "prop:value" -> "prop: value;" (only the first colon, so URLs stay intact).
    if (!/^\s+[-a-zA-Z]+\s*:/.test(line) || line.includes("{")) return line;
    const fixed = line.replace(/^(\s+[-a-zA-Z]+)\s*:\s*/, "$1: ");
    return /[;{}]\s*$/.test(fixed) ? fixed : `${fixed};`;
  });
  return tidy.join("\n") + "\n";
}

export function formatCode(source, language = "html") {
  return language === "css" ? formatCss(source) : formatHtml(source);
}
