import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, ChevronDown, LoaderCircle, MessageSquareText, Paperclip, Send, User, X } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { LitePageFrame } from "../components/LiteSurface";
import { api } from "../lib/api";
import { buildCurrentAuthRedirectPath } from "../lib/auth-redirect";
import { useSession } from "../lib/session";

type AssistantResponse = {
  conversationId: string;
  answer: string;
  relatedTutorials: Array<{ id: number; title: string; summary?: string; path: string }>;
  relatedQuestions: Array<{ id: number; title: string; explanation?: string; path: string }>;
  model?: string;
  fallbackUsed?: boolean;
};

type ChatTurn = {
  id: string;
  question: string;
  answer: string;
  relatedTutorials: AssistantResponse["relatedTutorials"];
  relatedQuestions: AssistantResponse["relatedQuestions"];
  attachments?: AssistantImageAttachment[];
  model?: string;
  fallbackUsed?: boolean;
  pending?: boolean;
  failed?: boolean;
};

type AssistantImageAttachment = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  dataUrl: string;
};

const quickPrompts = [
  "VLOOKUP 为什么会返回 #N/A？",
  "帮我写一个按部门汇总销售额的 SUMIFS 公式",
  "FILTER 和 SORTBY 怎么组合做排名？",
  "这个 IFERROR 公式为什么还是报错？",
];

const maxAssistantImageCount = 3;
const maxAssistantImageSize = 5 * 1024 * 1024;
const assistantImageFilePattern = /\.(png|jpe?g|webp|gif)$/i;

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

const readAssistantImageDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(normalizeAssistantImageDataUrl(file, String(reader.result || "")));
    reader.onerror = () => reject(reader.error || new Error("file read failed"));
    reader.readAsDataURL(file);
  });

export function Assistant() {
  const navigate = useNavigate();
  const { isAuthenticated } = useSession();
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);
  const [attachments, setAttachments] = useState<AssistantImageAttachment[]>([]);
  const [showLatestReply, setShowLatestReply] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const latestReplyRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const shouldScrollLatestRef = useRef(false);

  const isNearLatestReply = () => {
    const element = messagesRef.current;
    if (!element) return true;
    return element.scrollHeight - element.scrollTop - element.clientHeight < 96;
  };

  const scrollToLatestReply = (behavior: ScrollBehavior = "smooth") => {
    latestReplyRef.current?.scrollIntoView({ behavior, block: "end" });
    setShowLatestReply(false);
  };

  const chatMutation = useMutation({
    mutationFn: ({
      content,
      images,
    }: {
      content: string;
      images: AssistantImageAttachment[];
      turnId: string;
    }) =>
      api.post<AssistantResponse>("/api/assistant/chat", {
        message: content,
        conversationId,
        workbookContext: images.length > 0 ? images.map((item, index) => `图片 ${index + 1}: ${item.name} (${formatAssistantFileSize(item.size)}, ${item.mimeType})`).join("\n") : undefined,
        images: images.map((item) => ({
          name: item.name,
          mimeType: item.mimeType,
          size: item.size,
          dataUrl: item.dataUrl,
        })),
      }),
    onSuccess: (result, variables) => {
      const question = variables.content.trim() || "请分析我发送的图片内容";
      const shouldScrollToLatest = isNearLatestReply();
      shouldScrollLatestRef.current = shouldScrollToLatest;
      if (!shouldScrollToLatest) {
        setShowLatestReply(true);
      }
      setChatHistory((prev) => prev.map((item) => item.id === variables.turnId
        ? {
          ...item,
          question,
          answer: result.answer,
          relatedTutorials: result.relatedTutorials || [],
          relatedQuestions: result.relatedQuestions || [],
          attachments: variables.images,
          model: result.model,
          fallbackUsed: result.fallbackUsed,
          pending: false,
          failed: false,
        }
        : item));
      setConversationId(result.conversationId || null);
      if (shouldScrollToLatest) {
        requestAnimationFrame(() => scrollToLatestReply("smooth"));
      }
    },
    onError: (error: unknown, variables) => {
      const message = error instanceof Error ? error.message : "AI 助手暂时不可用";
      setChatHistory((prev) => prev.map((item) => item.id === variables?.turnId
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

  useEffect(() => {
    if (chatHistory.length === 0 || !shouldScrollLatestRef.current) return;
    shouldScrollLatestRef.current = false;
    requestAnimationFrame(() => scrollToLatestReply("smooth"));
  }, [chatHistory.length]);

  const closeAssistant = () => {
    const returnPath = window.sessionStorage.getItem("excelAssistantReturnPath");
    window.sessionStorage.removeItem("excelAssistantReturnPath");
    if (returnPath && !returnPath.startsWith("/assistant")) {
      navigate(returnPath, { replace: true });
      return;
    }
    navigate("/", { replace: true });
  };

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (panelRef.current?.contains(event.target as Node)) {
        return;
      }
      closeAssistant();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAssistant();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const readImageAttachment = async (file: File): Promise<AssistantImageAttachment> => {
    if (!isAssistantImageFile(file)) {
      throw new Error("仅支持 PNG、JPG、WEBP 或 GIF 图片");
    }
    if (file.size > maxAssistantImageSize) {
      throw new Error(`图片 ${file.name || "clipboard-image"} 超过 5MB`);
    }
    return {
      id: `${file.name || "clipboard-image"}-${file.lastModified}-${file.size}`,
      name: file.name || "clipboard-image.png",
      size: file.size,
      mimeType: getAssistantImageMimeType(file),
      dataUrl: await readAssistantImageDataUrl(file),
    };
  };

  const handleAssistantImages = async (files: FileList | File[] | null) => {
    if (!files?.length) return;
    const imageFiles = Array.from(files).filter(isAssistantImageFile);
    if (imageFiles.length === 0) {
      toast.info("请选择图片文件");
      return;
    }
    const remainingSlots = Math.max(0, maxAssistantImageCount - attachments.length);
    if (remainingSlots <= 0) {
      toast.info(`一次最多发送 ${maxAssistantImageCount} 张图片`);
      return;
    }
    const picked = imageFiles.slice(0, remainingSlots);
    try {
      const nextAttachments = await Promise.all(picked.map(readImageAttachment));
      setAttachments((prev) => [...prev, ...nextAttachments]);
      if (picked.length < imageFiles.length) {
        toast.info(`一次最多发送 ${maxAssistantImageCount} 张图片，已保留前 ${maxAssistantImageCount} 张`);
      }
      toast.success(`已添加 ${nextAttachments.length} 张图片`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图片读取失败，请换一张重试");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData?.items || [])
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file && isAssistantImageFile(file)));
    if (files.length === 0) return;
    event.preventDefault();
    void handleAssistantImages(files);
  };

  const handleMessagesScroll = () => {
    if (isNearLatestReply()) {
      setShowLatestReply(false);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const canSubmit = useMemo(() => (message.trim().length > 0 || attachments.length > 0) && !chatMutation.isPending, [message, attachments.length, chatMutation.isPending]);

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      toast.info("请先登录后再使用 AI 助手");
      navigate(buildCurrentAuthRedirectPath());
      return;
    }
    const content = message.trim();
    if (!content && attachments.length === 0) {
      toast.info("请先输入你的 Excel 问题或上传图片");
      return;
    }
    const question = content || "请分析我发送的图片内容";
    const images = attachments;
    const turnId = `${Date.now()}`;
    const shouldScrollToLatest = isNearLatestReply();
    shouldScrollLatestRef.current = shouldScrollToLatest;
    if (!shouldScrollToLatest) {
      setShowLatestReply(true);
    }
    setChatHistory((prev) => [
      ...prev,
      {
        id: turnId,
        question,
        answer: "",
        relatedTutorials: [],
        relatedQuestions: [],
        attachments: images,
        pending: true,
      },
    ]);
    setMessage("");
    setAttachments([]);
    try {
      await chatMutation.mutateAsync({
        turnId,
        content: question,
        images,
      });
    } catch {
      // error state is rendered by the mutation handler
    }
  };

  return (
    <LitePageFrame>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div ref={panelRef} className="rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
              <MessageSquareText size={16} />
              对话区
            </div>
          </div>

          <div className="relative">
            <div
              ref={messagesRef}
              onScroll={handleMessagesScroll}
              className="max-h-[min(64vh,720px)] min-h-[420px] space-y-5 overflow-y-auto px-4 py-5 sm:px-5"
            >
            {chatHistory.length === 0 ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-emerald-50 text-emerald-600">
                  <Bot size={26} />
                </div>
                <div className="mt-4 text-xl font-black text-slate-900">还没开始聊天</div>
                <div className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
                  你可以直接问函数写法、报错排查、公式解释，或者把实际业务场景扔过来。
                </div>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {quickPrompts.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setMessage(item)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatHistory.map((item, index) => (
                <div key={item.id} className="space-y-4">
                  <div className="flex justify-end">
                    <div className="min-w-0 max-w-[88%] rounded-[22px] rounded-br-md bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] px-4 py-3 text-sm leading-6 text-white shadow-[0_12px_24px_rgba(15,23,42,0.12)]">
                      <div className="mb-2 flex items-center gap-2 text-xs font-black text-white/75">
                        <User size={14} />
                        你
                      </div>
                      <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.question}</div>
                      {item.attachments && item.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/20 pt-2">
                          {item.attachments.map((attachment) => (
                            <span key={attachment.id} className="inline-flex items-center gap-1 rounded-full bg-white/16 px-2 py-1 text-[11px] font-bold text-white/88">
                              <img src={attachment.dataUrl} alt="" className="h-5 w-5 rounded object-cover" />
                              {attachment.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div ref={index === chatHistory.length - 1 ? latestReplyRef : undefined} className="flex justify-start">
                    <div className={`min-w-0 max-w-[92%] rounded-[22px] rounded-bl-md border px-4 py-4 text-sm leading-7 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ${
                      item.failed
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}>
                      <div className="mb-2 flex items-center gap-2 text-xs font-black text-emerald-700">
                        <Bot size={14} />
                        AI 助手
                      </div>
                      {item.pending ? (
                        <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-black text-slate-500">
                          <LoaderCircle size={15} className="animate-spin text-emerald-700" />
                          正在思考中...
                        </div>
                      ) : (
                        <>
                          <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.answer}</div>
                          {!item.failed ? (
                            <div className="mt-3 text-xs text-slate-400">
                              模型：{item.model || "-"}{item.fallbackUsed ? "（已走兜底）" : ""}
                            </div>
                          ) : null}
                        </>
                      )}

                      {!item.pending && item.relatedQuestions.length > 0 && (
                        <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                          {item.relatedQuestions.length > 0 && (
                            <div>
                              <div className="mb-2 text-xs font-black tracking-wide text-slate-500">相关练习</div>
                              <div className="flex flex-wrap gap-2">
                                {item.relatedQuestions.map((question) => (
                                  <button
                                    key={question.id}
                                    type="button"
                                    onClick={() => navigate(question.path)}
                                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                                  >
                                    {question.title}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            </div>
            {showLatestReply && chatHistory.length > 0 ? (
            <button
              type="button"
              onClick={() => scrollToLatestReply()}
              className="absolute bottom-4 right-5 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-black text-white shadow-[0_12px_28px_rgba(15,23,42,0.2)] transition hover:bg-slate-800"
            >
              <ChevronDown size={14} strokeWidth={2.4} />
              最新回复
            </button>
            ) : null}
          </div>

          <div className="border-t border-slate-100 bg-white px-4 py-4 sm:px-5">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={(event) => void handleAssistantImages(event.target.files)}
                className="hidden"
              />
              {attachments.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex max-w-full items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-800"
                    >
                      <img src={attachment.dataUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
                      <span className="max-w-[220px] truncate">{attachment.name}</span>
                      <span className="text-[10px] opacity-70">{formatAssistantFileSize(attachment.size)}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(attachment.id)}
                        className="rounded-full p-1 text-emerald-700 transition hover:bg-emerald-100"
                        aria-label={`移除 ${attachment.name}`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onPaste={handlePaste}
                placeholder="例如：为什么我的 VLOOKUP 一直返回 #N/A？"
                className="min-h-[110px] w-full resize-none bg-transparent px-1 py-1 text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-white hover:text-emerald-700"
                  aria-label="上传图片"
                  title="上传图片"
                >
                  <Paperclip size={18} strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] px-5 text-sm font-black text-white shadow-[0_12px_24px_rgba(15,23,42,0.12)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {chatMutation.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
                  {chatMutation.isPending ? "正在思考..." : "发送"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={closeAssistant}
        className="fixed bottom-24 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_100%)] px-4 py-3 text-sm font-black text-white shadow-[0_16px_36px_rgba(15,23,42,0.28)] ring-1 ring-white/10 backdrop-blur transition hover:opacity-95 md:bottom-8 md:right-6"
        aria-label="关闭 AI 助手"
      >
        <X size={18} strokeWidth={2.2} />
        <span>关闭助手</span>
      </button>
    </LitePageFrame>
  );
}
