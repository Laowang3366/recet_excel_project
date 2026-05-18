import { useMutation } from "@tanstack/react-query";
import { ChevronDown, LoaderCircle, Paperclip, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import { api } from "../../lib/api";
import { preloadPublicRoute } from "../../lib/route-preload";
import { useSession } from "../../lib/session";

const ASSISTANT_ENTRY_WIDTH = 104;
const ASSISTANT_ENTRY_HEIGHT = 132;

type AssistantWidgetResponse = {
  conversationId: string;
  answer: string;
  relatedTutorials: Array<{ id: number; title: string; summary?: string; path: string }>;
  relatedQuestions: Array<{ id: number; title: string; explanation?: string; path: string }>;
  model?: string;
  fallbackUsed?: boolean;
};

type AssistantWidgetAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
  readable: boolean;
  imageDataUrl?: string;
};

type AssistantWidgetTurn = {
  id: string;
  question: string;
  answer: string;
  relatedTutorials: AssistantWidgetResponse["relatedTutorials"];
  relatedQuestions: AssistantWidgetResponse["relatedQuestions"];
  attachments?: AssistantWidgetAttachment[];
  model?: string;
  fallbackUsed?: boolean;
  pending?: boolean;
  failed?: boolean;
};

type AssistantWidgetProps = {
  onOpen?: () => void;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AssistantWidget({ onOpen }: AssistantWidgetProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useSession();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState("");
  const [assistantConversationId, setAssistantConversationId] = useState<string | null>(null);
  const [assistantHistory, setAssistantHistory] = useState<AssistantWidgetTurn[]>([]);
  const [assistantAttachments, setAssistantAttachments] = useState<AssistantWidgetAttachment[]>([]);
  const [assistantDragPosition, setAssistantDragPosition] = useState<{ left: number; top: number } | null>(null);
  const [assistantDragging, setAssistantDragging] = useState(false);
  const [assistantShowLatestReply, setAssistantShowLatestReply] = useState(false);
  const assistantRef = useRef<HTMLDivElement>(null);
  const assistantMessagesRef = useRef<HTMLDivElement>(null);
  const assistantLatestReplyRef = useRef<HTMLDivElement>(null);
  const assistantFileInputRef = useRef<HTMLInputElement>(null);
  const assistantDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
    width: number;
    height: number;
    moved: boolean;
  } | null>(null);
  const assistantSuppressClickRef = useRef(false);
  const assistantEntryReturnPositionRef = useRef<{ left: number; top: number } | null>(null);
  const assistantEntryHadCustomPositionRef = useRef(false);
  const assistantPanelMovedRef = useRef(false);
  const assistantShouldScrollLatestRef = useRef(false);

  const clampAssistantPosition = (left: number, top: number, width: number, height: number) => {
    const padding = 8;
    const maxLeft = Math.max(padding, window.innerWidth - width - padding);
    const maxTop = Math.max(padding, window.innerHeight - height - padding);
    return {
      left: Math.min(Math.max(padding, left), maxLeft),
      top: Math.min(Math.max(padding, top), maxTop),
    };
  };

  const clampAssistantToViewport = () => {
    const rect = assistantRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAssistantDragPosition((current) => {
      if (!current) return current;
      const next = clampAssistantPosition(rect.left, rect.top, rect.width, rect.height);
      if (Math.abs(current.left - next.left) < 0.5 && Math.abs(current.top - next.top) < 0.5) {
        return current;
      }
      return next;
    });
  };

  const isAssistantNearLatestReply = () => {
    const element = assistantMessagesRef.current;
    if (!element) return true;
    return element.scrollHeight - element.scrollTop - element.clientHeight < 96;
  };

  const scrollAssistantToLatestReply = (behavior: ScrollBehavior = "smooth") => {
    assistantLatestReplyRef.current?.scrollIntoView({ behavior, block: "end" });
    setAssistantShowLatestReply(false);
  };

  const beginAssistantDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-assistant-no-drag='true'], input, textarea, select, a")) return;
    const rect = assistantRef.current?.getBoundingClientRect();
    if (!rect) return;
    assistantDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setAssistantDragging(true);
  };

  const moveAssistantDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = assistantDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
      drag.moved = true;
      assistantSuppressClickRef.current = true;
      if (assistantOpen) {
        assistantPanelMovedRef.current = true;
      }
    }
    if (!drag.moved) return;
    event.preventDefault();
    setAssistantDragPosition(
      clampAssistantPosition(
        drag.originLeft + deltaX,
        drag.originTop + deltaY,
        drag.width,
        drag.height,
      ),
    );
  };

  const endAssistantDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = assistantDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    assistantDragRef.current = null;
    setAssistantDragging(false);
    if (drag.moved) {
      window.setTimeout(() => {
        assistantSuppressClickRef.current = false;
      }, 0);
      return;
    }
    assistantSuppressClickRef.current = false;
  };

  useEffect(() => {
    if (!assistantOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (assistantRef.current && !assistantRef.current.contains(event.target as Node)) {
        closeAssistant();
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAssistant();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [assistantOpen]);

  useEffect(() => {
    if (!assistantDragPosition) return;
    const handleViewportChange = () => clampAssistantToViewport();
    const frameId = window.requestAnimationFrame(handleViewportChange);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
    };
  }, [assistantOpen, Boolean(assistantDragPosition)]);

  useEffect(() => {
    if (!assistantOpen || assistantHistory.length === 0) return;
    if (!assistantShouldScrollLatestRef.current) return;
    assistantShouldScrollLatestRef.current = false;
    requestAnimationFrame(() => scrollAssistantToLatestReply("smooth"));
  }, [assistantOpen, assistantHistory.length]);

  const assistantChatMutation = useMutation({
    mutationFn: ({
      message,
      conversationId,
      workbookContext,
      images,
    }: {
      message: string;
      conversationId: string | null;
      workbookContext?: string;
      turnId: string;
      attachments?: AssistantWidgetAttachment[];
      images?: Array<{ name: string; mimeType: string; size: number; dataUrl?: string }>;
    }) =>
      api.post<AssistantWidgetResponse>("/api/assistant/chat", {
        message,
        conversationId,
        workbookContext,
        images,
      }),
    onSuccess: (result, variables) => {
      const shouldScrollToLatest = !assistantOpen || isAssistantNearLatestReply();
      assistantShouldScrollLatestRef.current = shouldScrollToLatest;
      if (!shouldScrollToLatest) {
        setAssistantShowLatestReply(true);
      }
      setAssistantHistory((prev) => prev.map((item) => item.id === variables.turnId
        ? {
          ...item,
          answer: result.answer,
          relatedTutorials: result.relatedTutorials || [],
          relatedQuestions: result.relatedQuestions || [],
          attachments: variables.attachments || [],
          model: result.model,
          fallbackUsed: result.fallbackUsed,
          pending: false,
          failed: false,
        }
        : item));
      setAssistantConversationId(result.conversationId || null);
      if (shouldScrollToLatest) {
        requestAnimationFrame(() => scrollAssistantToLatestReply("smooth"));
      }
    },
    onError: (error: unknown, variables) => {
      const message = getErrorMessage(error, "AI 助手暂时不可用");
      setAssistantHistory((prev) => prev.map((item) => item.id === variables?.turnId
        ? {
          ...item,
          answer: message,
          relatedTutorials: [],
          relatedQuestions: [],
          pending: false,
          failed: true,
        }
        : item));
      toast.error(message);
    },
  });

  const assistantAnimatedAvatarSrc = "/assistant-ikun-animated.webp";
  const assistantReadableFilePattern = /\.(txt|csv|tsv|json|md|markdown|log|xml|html?|css|js|ts|tsx|sql)$/i;
  const assistantImageFilePattern = /\.(png|jpe?g|webp|gif)$/i;
  const assistantMaxAttachmentCount = 3;
  const assistantMaxImageSize = 5 * 1024 * 1024;
  const formatAssistantFileSize = (size: number) => {
    if (size < 1024) return `${size}B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
    return `${(size / 1024 / 1024).toFixed(1)}MB`;
  };
  const isAssistantImageFile = (file: File) => file.type.startsWith("image/") || assistantImageFilePattern.test(file.name);
  const getAssistantImageMimeType = (file: File) => {
    const type = file.type.toLowerCase();
    if (type === "image/jpg") return "image/jpeg";
    if (type.startsWith("image/")) return type;
    const fileName = file.name.toLowerCase();
    if (/\.jpe?g$/.test(fileName)) return "image/jpeg";
    if (/\.webp$/.test(fileName)) return "image/webp";
    if (/\.gif$/.test(fileName)) return "image/gif";
    return "image/png";
  };
  const normalizeAssistantImageDataUrl = (file: File, dataUrl: string) => {
    const mimeType = getAssistantImageMimeType(file);
    if (/^data:image\/jpg;base64,/i.test(dataUrl)) {
      return dataUrl.replace(/^data:image\/jpg;base64,/i, "data:image/jpeg;base64,");
    }
    if (/^data:(?:application\/octet-stream)?;base64,/i.test(dataUrl)) {
      return dataUrl.replace(/^data:(?:application\/octet-stream)?;base64,/i, `data:${mimeType};base64,`);
    }
    return dataUrl;
  };
  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(normalizeAssistantImageDataUrl(file, String(reader.result || "")));
      reader.onerror = () => reject(reader.error || new Error("file read failed"));
      reader.readAsDataURL(file);
    });
  const readAssistantAttachment = async (file: File): Promise<AssistantWidgetAttachment> => {
    if (isAssistantImageFile(file)) {
      if (file.size > assistantMaxImageSize) {
        throw new Error(`图片 ${file.name || "clipboard-image"} 超过 5MB`);
      }
      return {
        id: `${file.name || "clipboard-image"}-${file.lastModified}-${file.size}`,
        name: file.name || "clipboard-image.png",
        size: file.size,
        type: getAssistantImageMimeType(file),
        readable: true,
        imageDataUrl: await readFileAsDataUrl(file),
      };
    }
    const readable = file.type.startsWith("text/") || assistantReadableFilePattern.test(file.name);
    if (!readable) {
      return {
        id: `${file.name}-${file.lastModified}-${file.size}`,
        name: file.name,
        size: file.size,
        type: file.type || "unknown",
        readable: false,
      };
    }
    const text = await file.text();
    const clipped = text.length > 12000 ? `${text.slice(0, 12000)}\n\n[内容较长，已截取前 12000 字符]` : text;
    return {
      id: `${file.name}-${file.lastModified}-${file.size}`,
      name: file.name,
      size: file.size,
      type: file.type || "text/plain",
      content: clipped,
      readable: true,
    };
  };
  const handleAssistantFiles = async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    const incomingFiles = Array.from(files);
    const remainingSlots = Math.max(0, assistantMaxAttachmentCount - assistantAttachments.length);
    if (remainingSlots <= 0) {
      toast.info(`一次最多发送 ${assistantMaxAttachmentCount} 个附件`);
      return;
    }
    const picked = incomingFiles.slice(0, remainingSlots);
    try {
      const nextAttachments = await Promise.all(picked.map(readAssistantAttachment));
      setAssistantAttachments((prev) => [...prev, ...nextAttachments]);
      if (picked.length < incomingFiles.length) {
        toast.info(`一次最多发送 ${assistantMaxAttachmentCount} 个附件，已保留前 ${assistantMaxAttachmentCount} 个`);
      }
      const imageCount = nextAttachments.filter((item) => item.imageDataUrl).length;
      if (imageCount > 0) {
        toast.success(`已添加 ${imageCount} 张图片`);
      }
      const unreadableCount = nextAttachments.filter((item) => !item.readable && !item.imageDataUrl).length;
      if (unreadableCount > 0) {
        toast.info("部分附件无法在浏览器内读取内容，将只发送文件名和大小");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "附件读取失败，请换一个文件重试");
    } finally {
      if (assistantFileInputRef.current) {
        assistantFileInputRef.current.value = "";
      }
    }
  };
  const removeAssistantAttachment = (id: string) => {
    setAssistantAttachments((prev) => prev.filter((item) => item.id !== id));
  };
  const buildAssistantAttachmentContext = () => {
    if (assistantAttachments.length === 0) return "";
    return assistantAttachments
      .map((item, index) => {
        const header = `附件 ${index + 1}: ${item.name} (${formatAssistantFileSize(item.size)}, ${item.type || "unknown"})`;
        if (item.imageDataUrl) {
          return `${header}\n说明：该附件是图片，已作为图片发送给 AI 助手。`;
        }
        return item.readable && item.content
          ? `${header}\n内容：\n${item.content}`
          : `${header}\n说明：该附件已选择，但当前浏览器端无法直接读取二进制内容。`;
      })
      .join("\n\n");
  };
  const buildAssistantImagePayload = () =>
    assistantAttachments
      .filter((item) => item.imageDataUrl)
      .map((item) => ({
        name: item.name,
        mimeType: item.type || "image/png",
        size: item.size,
        dataUrl: item.imageDataUrl,
      }));
  const handleAssistantPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData?.items || [])
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file && isAssistantImageFile(file)));
    if (files.length === 0) return;
    event.preventDefault();
    void handleAssistantFiles(files);
  };
  const handleAssistantMessagesScroll = () => {
    if (isAssistantNearLatestReply()) {
      setAssistantShowLatestReply(false);
    }
  };
  const openAssistant = () => {
    const rect = assistantRef.current?.getBoundingClientRect();
    if (rect) {
      const entryPosition = clampAssistantPosition(rect.left, rect.top, rect.width, rect.height);
      assistantEntryReturnPositionRef.current = entryPosition;
      assistantEntryHadCustomPositionRef.current = assistantDragPosition !== null;
      assistantPanelMovedRef.current = false;
      if (assistantDragPosition) {
        setAssistantDragPosition(
          clampAssistantPosition(
            entryPosition.left,
            entryPosition.top,
            ASSISTANT_ENTRY_WIDTH,
            ASSISTANT_ENTRY_HEIGHT,
          ),
        );
      }
    }
    assistantShouldScrollLatestRef.current = true;
    setAssistantShowLatestReply(false);
    setAssistantOpen(true);
    onOpen?.();
    window.sessionStorage.setItem(
      "excelAssistantReturnPath",
      `${location.pathname}${location.search}${location.hash}`,
    );
  };
  const closeAssistant = () => {
    if (!assistantPanelMovedRef.current && assistantEntryReturnPositionRef.current) {
      if (assistantEntryHadCustomPositionRef.current) {
        setAssistantDragPosition(
          clampAssistantPosition(
            assistantEntryReturnPositionRef.current.left,
            assistantEntryReturnPositionRef.current.top,
            ASSISTANT_ENTRY_WIDTH,
            ASSISTANT_ENTRY_HEIGHT,
          ),
        );
      } else {
        setAssistantDragPosition(null);
      }
    }
    assistantEntryReturnPositionRef.current = null;
    assistantEntryHadCustomPositionRef.current = false;
    assistantPanelMovedRef.current = false;
    setAssistantOpen(false);
  };
  const submitAssistantMessage = async (text?: string) => {
    const content = (text ?? assistantMessage).trim();
    if (assistantChatMutation.isPending) return;
    if (!isAuthenticated) {
      toast.info("请先登录后再使用 AI 助手");
      navigate("/auth");
      return;
    }
    if (!content && assistantAttachments.length === 0) {
      toast.info("请先输入你的 Excel 问题");
      return;
    }
    const question = content || "请分析我发送的附件内容";
    const attachments = assistantAttachments;
    const workbookContext = buildAssistantAttachmentContext();
    const images = buildAssistantImagePayload();
    const turnId = `${Date.now()}`;
    const shouldScrollToLatest = !assistantOpen || isAssistantNearLatestReply();
    assistantShouldScrollLatestRef.current = shouldScrollToLatest;
    if (!shouldScrollToLatest) {
      setAssistantShowLatestReply(true);
    }
    setAssistantHistory((prev) => [
      ...prev,
      {
        id: turnId,
        question,
        answer: "",
        relatedTutorials: [],
        relatedQuestions: [],
        attachments,
        pending: true,
      },
    ]);
    setAssistantMessage("");
    setAssistantAttachments([]);
    try {
      await assistantChatMutation.mutateAsync({
        turnId,
        message: question,
        conversationId: assistantConversationId,
        workbookContext,
        images,
        attachments,
      });
    } catch {
      // error state is rendered by the mutation handler
    }
  };
  const assistantPromptSnippets = [
    "VLOOKUP 为什么会返回 #N/A？",
    "帮我写一个按部门汇总销售额的 SUMIFS 公式",
    "FILTER 和 SORTBY 怎么组合做排名？",
  ];
  const assistantCanSubmit = (assistantMessage.trim().length > 0 || assistantAttachments.length > 0) && !assistantChatMutation.isPending;
  const assistantFloatingClassName = assistantDragPosition
    ? "fixed z-50 h-[132px] w-[104px]"
    : "fixed right-3 top-1/2 z-50 h-[132px] w-[104px] -translate-y-1/2 md:right-5";
  const assistantFloatingStyle = assistantDragPosition
    ? { left: assistantDragPosition.left, top: assistantDragPosition.top }
    : undefined;
  const assistantPanelOpensLeft = !assistantDragPosition || assistantDragPosition.left > window.innerWidth / 2;
  const assistantPanelPositionClassName = assistantPanelOpensLeft
    ? "right-[88px] origin-bottom-right"
    : "left-[88px] origin-bottom-left";
  const assistantPanelArrowClassName = assistantPanelOpensLeft
    ? "-right-3 border-r border-t"
    : "-left-3 border-b border-l";

  if (location.pathname.startsWith("/assistant")) {
    return null;
  }

  return (
    <div ref={assistantRef} className={assistantFloatingClassName} style={assistantFloatingStyle}>
      <>
        {assistantOpen && (
          <div
            className={`absolute bottom-6 z-10 w-[min(24rem,calc(100vw-7rem))] max-h-[min(76vh,620px)] animate-in fade-in-0 zoom-in-95 slide-in-from-right-4 duration-200 ${assistantPanelPositionClassName}`}
          >
            <div className="relative">
              <span className={`pointer-events-none absolute bottom-12 h-7 w-7 rotate-45 rounded-[7px] border-slate-200 bg-white shadow-[12px_12px_34px_rgba(15,23,42,0.12)] ${assistantPanelArrowClassName}`} />
              <div className="relative z-10 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
                <div
                  className={`relative touch-none select-none bg-[#0f91dd] px-5 pb-5 pt-6 text-white shadow-[0_10px_22px_rgba(15,145,221,0.25)] ${
                    assistantDragging ? "cursor-grabbing" : "cursor-grab"
                  }`}
                  onPointerDown={beginAssistantDrag}
                  onPointerMove={moveAssistantDrag}
                  onPointerUp={endAssistantDrag}
                  onPointerCancel={endAssistantDrag}
                >
                  <button
                    type="button"
                    onClick={closeAssistant}
                    data-assistant-no-drag="true"
                    className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-white/76 transition hover:bg-white/12 hover:text-white"
                    aria-label="关闭 AI 助手"
                  >
                    <X size={18} strokeWidth={2.2} />
                  </button>
                  <div className="pr-8">
                    <div>
                      <div className="text-xl font-black leading-none">欢迎</div>
                      <div className="mt-2 text-sm font-bold leading-6 text-white/90">
                        您好，我是 AI 助手，直接发送消息即可。
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div
                    ref={assistantMessagesRef}
                    onScroll={handleAssistantMessagesScroll}
                    className="max-h-[min(46vh,360px)] min-h-[270px] overflow-y-auto bg-white px-4 py-4"
                  >
                    {assistantHistory.length === 0 ? (
                      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
                        <div className="flex flex-wrap justify-center gap-2">
                          {assistantPromptSnippets.map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => setAssistantMessage(item)}
                              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:border-[#0f91dd]/40 hover:bg-[#0f91dd]/8 hover:text-[#0f91dd]"
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {assistantHistory.map((item, index) => (
                          <div key={item.id} className="space-y-3">
                            <div className="flex justify-end">
                              <div className="min-w-0 max-w-[86%] rounded-2xl rounded-br-md bg-[#0f91dd] px-3.5 py-2.5 text-sm leading-6 text-white shadow-sm">
                                <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.question}</div>
                                {item.attachments && item.attachments.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/20 pt-2">
                                    {item.attachments.map((attachment) => (
                                      <span key={attachment.id} className="inline-flex items-center gap-1 rounded-full bg-white/16 px-2 py-1 text-[11px] font-bold text-white/88">
                                        {attachment.imageDataUrl ? <img src={attachment.imageDataUrl} alt="" className="h-5 w-5 rounded object-cover" /> : <Paperclip size={12} />}
                                        {attachment.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div ref={index === assistantHistory.length - 1 ? assistantLatestReplyRef : undefined} className="flex justify-start">
                              <div className={`min-w-0 max-w-[90%] rounded-2xl rounded-bl-md border px-3.5 py-3 text-sm leading-6 shadow-sm ${
                                item.failed
                                  ? "border-rose-200 bg-rose-50 text-rose-700"
                                  : "border-slate-200 bg-slate-50 text-slate-700"
                              }`}>
                                <div className="mb-2 flex items-center gap-2 text-xs font-black text-[#0f91dd]">
                                  AI助手
                                </div>
                                {item.pending ? (
                                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-black text-slate-500">
                                    <LoaderCircle size={15} className="animate-spin text-[#0f91dd]" />
                                    正在思考中...
                                  </div>
                                ) : (
                                  <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.answer}</div>
                                )}
                                {!item.pending && item.relatedQuestions.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                                    {item.relatedQuestions.map((question) => (
                                      <button
                                        key={`question-${question.id}`}
                                        type="button"
                                        onClick={() => {
                                          closeAssistant();
                                          navigate(question.path);
                                        }}
                                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-500 transition hover:border-[#0f91dd]/40 hover:text-[#0f91dd]"
                                      >
                                        {question.title}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {assistantShowLatestReply && assistantHistory.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => scrollAssistantToLatestReply()}
                      data-assistant-no-drag="true"
                      className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-[#0f91dd] px-3 py-1.5 text-xs font-black text-white shadow-[0_10px_24px_rgba(15,145,221,0.28)] transition hover:bg-[#0b82c9]"
                    >
                      <ChevronDown size={14} strokeWidth={2.4} />
                      最新回复
                    </button>
                  ) : null}
                </div>

                <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    ref={assistantFileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.txt,.csv,.tsv,.json,.md,.markdown,.log,.xml,.html,.htm,.css,.js,.ts,.tsx,.sql,.xls,.xlsx"
                    onChange={(event) => void handleAssistantFiles(event.target.files)}
                    className="hidden"
                  />
                  {assistantAttachments.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {assistantAttachments.map((attachment) => (
                        <span
                          key={attachment.id}
                          className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
                            attachment.readable
                              ? "border-[#0f91dd]/20 bg-[#0f91dd]/8 text-[#0f91dd]"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          }`}
                        >
                          {attachment.imageDataUrl ? (
                            <img src={attachment.imageDataUrl} alt="" className="h-7 w-7 rounded object-cover" />
                          ) : (
                            <Paperclip size={13} />
                          )}
                          <span className="max-w-[180px] truncate">{attachment.name}</span>
                          <span className="text-[10px] opacity-70">{formatAssistantFileSize(attachment.size)}</span>
                          <button
                            type="button"
                            onClick={() => removeAssistantAttachment(attachment.id)}
                            className="ml-0.5 rounded-full p-0.5 transition hover:bg-black/5"
                            aria-label={`移除 ${attachment.name}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-end gap-2 rounded-[18px] border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <textarea
                      value={assistantMessage}
                      onChange={(event) => setAssistantMessage(event.target.value)}
                      onPaste={handleAssistantPaste}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void submitAssistantMessage();
                        }
                      }}
                      rows={1}
                      placeholder="输入消息..."
                      className="min-h-10 flex-1 resize-none bg-transparent py-2 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => assistantFileInputRef.current?.click()}
                      className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-[#0f91dd]"
                      aria-label="添加附件"
                    >
                      <Paperclip size={19} strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitAssistantMessage()}
                      disabled={!assistantCanSubmit}
                      className="mb-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0f91dd] text-white shadow-sm transition hover:bg-[#0b82c9] disabled:cursor-not-allowed disabled:bg-slate-300"
                      aria-label="发送"
                    >
                      {assistantChatMutation.isPending ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={(event) => {
            if (assistantSuppressClickRef.current) {
              event.preventDefault();
              return;
            }
            if (assistantOpen) {
              closeAssistant();
            } else {
              openAssistant();
            }
          }}
          onPointerDown={beginAssistantDrag}
          onPointerMove={moveAssistantDrag}
          onPointerUp={endAssistantDrag}
          onPointerCancel={endAssistantDrag}
          onPointerEnter={() => void preloadPublicRoute("/assistant")}
          onFocus={() => void preloadPublicRoute("/assistant")}
          onTouchStart={() => void preloadPublicRoute("/assistant")}
          className={`group absolute inset-0 z-20 -m-3 inline-flex h-[132px] w-[104px] touch-none select-none items-end justify-center rounded-[32px] p-3 ${
            assistantDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          aria-label={assistantOpen ? "关闭 AI 助手" : "打开 AI 助手"}
          aria-expanded={assistantOpen}
        >
          <span className="absolute -top-3 left-1/2 z-10 inline-flex h-10 -translate-x-1/2 items-center whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 text-sm font-black text-[#0f91dd] shadow-[0_10px_28px_rgba(15,23,42,0.14)] transition group-hover:border-[#0f91dd]/30 group-hover:bg-[#f1f9ff]">
            AI助手
          </span>
          <span className="relative inline-flex h-[86px] w-[78px] items-center justify-center transition group-hover:scale-[1.04]">
            <img src={assistantAnimatedAvatarSrc} alt="" draggable={false} className="h-[82px] w-[82px] -scale-x-100 select-none object-contain drop-shadow-[0_13px_16px_rgba(0,55,84,0.30)]" />
            <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-[#16c784] ring-2 ring-white" />
          </span>
        </button>
      </>
    </div>
  );
}
