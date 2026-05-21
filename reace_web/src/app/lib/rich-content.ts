import { normalizeResourceUrl } from "./mappers";

export function renderRichContent(content: string) {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";
  const candidate = looksLikeEscapedHtml(normalized) ? decodeHtmlEntities(normalized) : normalized;
  if (looksLikeHtml(candidate)) {
    return renderHtmlContent(candidate);
  }
  return renderMarkdownContent(candidate);
}

function renderMarkdownContent(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const codeBlocks: string[] = [];

  let html = escapeHtml(normalized).replace(/```([\w-]*)\n([\s\S]*?)```/g, (_match, _language, code) => {
    const block = `<pre class="overflow-x-auto rounded-2xl bg-slate-900 px-4 py-4 text-sm text-slate-100"><code>${highlightCodeSyntax(code)}</code></pre>`;
    const token = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(block);
    return token;
  });

  html = html.replace(/^### (.+)$/gm, '<h3 class="mt-6 mb-3 text-xl font-bold text-slate-900">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="mt-8 mb-4 text-2xl font-bold text-slate-900">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="mt-8 mb-4 text-3xl font-bold text-slate-900">$1</h1>');
  html = html.replace(/^> (.+)$/gm, '<blockquote class="my-4 border-l-4 border-teal-300 bg-teal-50/70 px-4 py-3 italic text-slate-600">$1</blockquote>');
  html = html.replace(/^---$/gm, '<hr class="my-6 border-slate-200" />');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, src) => (
    `<figure class="my-5"><img src="${escapeHtml(normalizeResourceUrl(src))}" alt="${alt}" class="max-h-96 rounded-2xl border border-slate-200 object-contain" /><figcaption class="mt-2 text-sm text-slate-400">${alt}</figcaption></figure>`
  ));
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, href) => (
    `<a href="${escapeHtml(normalizeResourceUrl(href))}" target="_blank" rel="noreferrer" class="font-medium text-teal-600 underline underline-offset-4">${text}</a>`
  ));
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/~~([^~]+)~~/g, '<del class="text-slate-500">$1</del>');
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, '<code class="rounded-md bg-slate-200 px-1.5 py-0.5 text-sm text-slate-800">$1</code>');
  html = html.replace(/<u>(.*?)<\/u>/g, "<u>$1</u>");
  html = html.replace(/(<div align="(?:left|center|right)">[\s\S]*?<\/div>)/g, (_match, block) =>
    block.replace(/\n/g, "<br />")
  );
  html = html.replace(/((?:^\|.+\|\n?)+)/gm, (tableBlock) => renderTableBlock(tableBlock));
  html = html.replace(/(?:^|\n)(\d+\.\s.+(?:\n\d+\.\s.+)*)/g, (_match, listBlock) => `\n${renderOrderedList(listBlock)}\n`);
  html = html.replace(/(?:^|\n)((?:[-*]\s.+\n?)+)/g, (_match, listBlock) => `\n${renderUnorderedList(listBlock)}\n`);

  const paragraphs = html
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<h\d|^<blockquote|^<pre|^<ul|^<ol|^<figure|^<hr|^<table|^<div /.test(trimmed)) {
        return trimmed;
      }
      return `<p class="mb-4 leading-7">${trimmed.replace(/\n/g, "<br />")}</p>`;
    })
    .filter(Boolean)
    .join("");

  return codeBlocks.reduce((result, block, index) => result.replace(`__CODE_BLOCK_${index}__`, block), paragraphs);
}

function renderHtmlContent(html: string) {
  const safeHtml = sanitizeRichHtml(html);
  if (typeof DOMParser === "undefined") {
    return safeHtml;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div data-rich-content-root="true">${safeHtml}</div>`, "text/html");
  const root = doc.body.querySelector('[data-rich-content-root="true"]');
  if (!root) return safeHtml;

  root.querySelectorAll("script, style, iframe, object, embed").forEach((node) => node.remove());
  root.querySelectorAll("*").forEach((node) => {
    const element = node as HTMLElement;
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;
      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name);
        return;
      }
      if ((name === "src" || name === "href") && /^\s*javascript:/i.test(value)) {
        element.removeAttribute(attribute.name);
        return;
      }
      if (name === "src" || name === "href") {
        element.setAttribute(attribute.name, normalizeResourceUrl(value));
      }
    });

    switch (element.tagName.toLowerCase()) {
      case "a":
        appendClassName(element, "font-medium text-teal-600 underline underline-offset-4");
        element.setAttribute("target", "_blank");
        element.setAttribute("rel", "noreferrer");
        break;
      case "img":
        appendClassName(element, "my-4 block max-h-[32rem] max-w-full rounded-2xl border border-slate-200 object-contain");
        element.setAttribute("loading", "lazy");
        break;
      case "p":
        appendClassName(element, "mb-4 leading-7");
        break;
      case "blockquote":
        appendClassName(element, "my-4 border-l-4 border-teal-300 bg-teal-50/70 px-4 py-3 italic text-slate-600");
        break;
      case "pre":
        appendClassName(element, "my-4 overflow-x-auto rounded-2xl bg-slate-900 px-4 py-4 text-sm text-slate-100");
        break;
      case "code":
        if (element.parentElement?.tagName.toLowerCase() === "pre") {
          appendClassName(element, "block whitespace-pre-wrap");
        } else {
          appendClassName(element, "rounded-md bg-slate-200 px-1.5 py-0.5 text-sm text-slate-800");
        }
        break;
      case "table":
        appendClassName(element, "my-5 min-w-full border-collapse overflow-hidden rounded-xl");
        break;
      case "th":
        appendClassName(element, "border border-slate-200 bg-slate-100 px-3 py-2 text-left font-bold text-slate-700");
        break;
      case "td":
        appendClassName(element, "border border-slate-200 px-3 py-2 text-slate-600");
        break;
      case "ul":
        appendClassName(element, "my-4 space-y-2 text-slate-700");
        break;
      case "ol":
        appendClassName(element, "my-4 space-y-2 text-slate-700");
        break;
      case "li":
        if (element.parentElement?.tagName.toLowerCase() === "ol") {
          appendClassName(element, "ml-5 list-decimal pl-1");
        } else {
          appendClassName(element, "ml-5 list-disc pl-1");
        }
        break;
      case "h1":
        appendClassName(element, "mt-8 mb-4 text-3xl font-bold text-slate-900");
        break;
      case "h2":
        appendClassName(element, "mt-8 mb-4 text-2xl font-bold text-slate-900");
        break;
      case "h3":
        appendClassName(element, "mt-6 mb-3 text-xl font-bold text-slate-900");
        break;
      case "hr":
        appendClassName(element, "my-6 border-slate-200");
        break;
      default:
        break;
    }
  });

  root.querySelectorAll("table").forEach((table) => {
    if (table.parentElement?.tagName.toLowerCase() === "div" && table.parentElement.hasAttribute("data-table-wrapper")) {
      return;
    }
    const wrapper = doc.createElement("div");
    wrapper.setAttribute("data-table-wrapper", "true");
    wrapper.className = "my-5 overflow-x-auto";
    table.parentNode?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });

  return root.innerHTML;
}

export function sanitizeRichHtml(html: string) {
  if (!html) return "";
  if (typeof DOMParser === "undefined") {
    return sanitizeRichHtmlFallback(html);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div data-rich-content-root="true">${html}</div>`, "text/html");
  const root = doc.body.querySelector('[data-rich-content-root="true"]');
  if (!root) return "";

  root.querySelectorAll("script, style, iframe, object, embed").forEach((node) => node.remove());
  root.querySelectorAll("*").forEach((node) => {
    const element = node as HTMLElement;
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;
      if (name.startsWith("on")) {
        element.removeAttribute(attribute.name);
        return;
      }
      if ((name === "src" || name === "href") && /^\s*javascript:/i.test(value)) {
        element.removeAttribute(attribute.name);
        return;
      }
      if (name === "src" || name === "href") {
        element.setAttribute(attribute.name, normalizeResourceUrl(value));
      }
    });
  });

  return root.innerHTML;
}

function sanitizeRichHtmlFallback(html: string) {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(src|href)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, "")
    .replace(/\s(src|href)\s*=\s*(["'])([^"']+)\2/gi, (_match, attr, quote, value) => (
      ` ${attr}=${quote}${escapeHtml(normalizeResourceUrl(value))}${quote}`
    ));
}

export function stripRichContent(markdown: string) {
  const normalized = decodeHtmlEntities(markdown || "");
  return normalized
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<img[\s\S]*?>/gi, " [图片] ")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1 ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[*_~`>#|]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function renderUnorderedList(listBlock: string) {
  const items = listBlock
    .trim()
    .split("\n")
    .map((line) => line.replace(/^[-*]\s/, "").trim())
    .filter(Boolean)
    .map((item) => `<li class="ml-5 list-disc pl-1">${item}</li>`)
    .join("");
  return `<ul class="my-4 space-y-2 text-slate-700">${items}</ul>`;
}

function renderOrderedList(listBlock: string) {
  const items = listBlock
    .trim()
    .split("\n")
    .map((line) => line.replace(/^\d+\.\s/, "").trim())
    .filter(Boolean)
    .map((item) => `<li class="ml-5 list-decimal pl-1">${item}</li>`)
    .join("");
  return `<ol class="my-4 space-y-2 text-slate-700">${items}</ol>`;
}

function renderTableBlock(tableBlock: string) {
  const rows = tableBlock
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));

  if (rows.length < 2) {
    return tableBlock;
  }

  const [header, ...bodyRows] = rows;
  const filteredBody = bodyRows.filter((row) => !row.every((cell) => /^-+$/.test(cell.replace(/:/g, ""))));

  const headerHtml = header.map((cell) => `<th class="border border-slate-200 bg-slate-100 px-3 py-2 text-left font-bold text-slate-700">${cell}</th>`).join("");
  const bodyHtml = filteredBody
    .map((row) => `<tr>${row.map((cell) => `<td class="border border-slate-200 px-3 py-2 text-slate-600">${cell}</td>`).join("")}</tr>`)
    .join("");

  return `<div class="my-5 overflow-x-auto"><table class="min-w-full border-collapse rounded-xl overflow-hidden"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function looksLikeEscapedHtml(value: string) {
  return /&lt;\/?[a-z][\s\S]*&gt;/i.test(value);
}

function decodeHtmlEntities(value: string) {
  if (typeof DOMParser !== "undefined") {
    const parsed = new DOMParser().parseFromString(value, "text/html");
    return parsed.documentElement.textContent || value;
  }
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function appendClassName(element: HTMLElement, className: string) {
  const current = element.getAttribute("class");
  element.setAttribute("class", current ? `${current} ${className}` : className);
}

export function highlightCodeSyntax(code: string) {
  const escaped = escapeHtml(code);
  const lines = escaped.split("\n").map((line) => {
    let html = line;
    html = html.replace(/(&quot;[^&]*&quot;|'[^']*')/g, '<span style="color:#fbbf24;">$1</span>');
    html = html.replace(/\b(const|let|var|function|return|if|else|for|while|switch|case|break|continue|class|new|async|await|try|catch|finally|import|from|export|default)\b/g, '<span style="color:#60a5fa;">$1</span>');
    html = html.replace(/\b(true|false|null|undefined)\b/g, '<span style="color:#c084fc;">$1</span>');
    html = html.replace(/\b(\d+)\b/g, '<span style="color:#fca5a5;">$1</span>');
    html = html.replace(/(\/\/.*)$/g, '<span style="color:#94a3b8;">$1</span>');
    return html;
  });
  return lines.join("<br />");
}
