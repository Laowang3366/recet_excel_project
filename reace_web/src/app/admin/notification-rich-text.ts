export type NotificationEditorCommand = "bold" | "italic" | "paragraph" | "list" | "smile" | "link" | "image";

export type NotificationSelection = {
  start: number;
  end: number;
};

export function applyNotificationEditorCommand(
  content: string,
  selection: NotificationSelection,
  command: NotificationEditorCommand,
) {
  const source = content || "";
  const safeStart = Math.max(0, Math.min(selection.start, source.length));
  const safeEnd = Math.max(safeStart, Math.min(selection.end, source.length));
  const selected = source.slice(safeStart, safeEnd);
  const snippet = buildSnippet(command, selected);
  const nextContent = `${source.slice(0, safeStart)}${snippet}${source.slice(safeEnd)}`;
  const cursor = safeStart + snippet.length;
  return { content: nextContent, cursor };
}

function buildSnippet(command: NotificationEditorCommand, selected: string) {
  switch (command) {
    case "bold":
      return `<strong>${selected || "加粗内容"}</strong>`;
    case "italic":
      return `<em>${selected || "斜体内容"}</em>`;
    case "paragraph":
      return `<p>${selected || "通知正文"}</p>`;
    case "list":
      return `<ul><li>${selected || "列表项"}</li></ul>`;
    case "smile":
      return selected ? `${selected} 🙂` : "🙂";
    case "link":
      return `<a href="https://">${selected || "链接文本"}</a>`;
    case "image":
      return `<img src="https://" alt="${selected || "图片"}" />`;
    default:
      return selected;
  }
}
