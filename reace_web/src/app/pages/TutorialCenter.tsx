import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calculator,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  FileText,
  GraduationCap,
  ListChecks,
  ListTree,
  Search,
  Table2,
  Target,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { LitePageFrame } from "../components/LiteSurface";
import { useIsMobile } from "../components/ui/use-mobile";
import { api } from "../lib/api";
import { tutorialKeys } from "../lib/query-keys";
import { renderRichContent, sanitizeRichHtml, stripRichContent } from "../lib/rich-content";
import {
  getLiteMobileContentPaddingClassName,
  getTutorialReaderScrollTargetSelector,
  shouldRenderTutorialCatalog,
  shouldRenderTutorialInlineArticle,
  shouldRenderTutorialReaderOverlay,
} from "../lib/tutorial-display";

type TutorialRelatedItem = {
  id: number;
  title?: string | null;
  name?: string | null;
};

type TutorialArticle = {
  id: number;
  title: string;
  summary?: string | null;
  oneLineUsage?: string | null;
  content?: string | null;
  contentLoading?: boolean;
  audienceTrack?: string | null;
  difficulty?: string | null;
  functionTags?: string | string[] | null;
  relatedQuestions?: TutorialRelatedItem[];
  relatedChapters?: TutorialRelatedItem[];
};

type TutorialCategory = {
  id: number;
  name: string;
  description?: string | null;
  articles?: TutorialArticle[];
};

type TutorialHomeResponse = {
  categories?: TutorialCategory[];
};

type TutorialArticleResponse = {
  article?: TutorialArticle;
};

export function TutorialCenter() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const routeKeyword = searchParams.get("search") || searchParams.get("q") || "";
  const tutorialsQuery = useQuery({
    queryKey: tutorialKeys.home(),
    queryFn: () => api.get<TutorialHomeResponse>("/api/tutorials/home", { silent: true }),
  });

  const categories = tutorialsQuery.data?.categories || [];
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [activeArticleId, setActiveArticleId] = useState<number | null>(null);
  const [searchKeyword, setSearchKeyword] = useState(routeKeyword);
  const [expandedMobileCategoryId, setExpandedMobileCategoryId] = useState<number | null>(null);
  const [mobileReaderArticleId, setMobileReaderArticleId] = useState<number | null>(null);

  useEffect(() => {
    setSearchKeyword(routeKeyword);
  }, [routeKeyword]);

  const visibleCategories = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return categories;
    }

    return categories
      .map((category) => {
        const categoryMatched = [category.name, category.description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword));
        const articles = (category.articles || []).filter((article) => {
          const tags = Array.isArray(article.functionTags) ? article.functionTags : [article.functionTags];
          return [article.title, article.summary, article.oneLineUsage, ...tags]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(keyword));
        });
        if (categoryMatched) {
          return category;
        }
        if (!articles.length) {
          return null;
        }
        return { ...category, articles };
      })
      .filter((category): category is TutorialCategory => Boolean(category));
  }, [categories, searchKeyword]);

  useEffect(() => {
    if (!visibleCategories.length) {
      setActiveCategoryId(null);
      setActiveArticleId(null);
      return;
    }
    const nextCategoryId = activeCategoryId && visibleCategories.some((item) => item.id === activeCategoryId)
      ? activeCategoryId
      : visibleCategories[0].id;
    const matchedCategory = visibleCategories.find((item) => item.id === nextCategoryId) || visibleCategories[0];
    const nextArticleId = activeArticleId && matchedCategory.articles?.some((item) => item.id === activeArticleId)
      ? activeArticleId
      : matchedCategory.articles?.[0]?.id || null;
    setActiveCategoryId(nextCategoryId);
    setActiveArticleId(nextArticleId);
  }, [visibleCategories, activeArticleId, activeCategoryId]);

  const activeCategory = useMemo(
    () => visibleCategories.find((item) => item.id === activeCategoryId) || visibleCategories[0] || null,
    [visibleCategories, activeCategoryId]
  );
  const activeArticle = useMemo(
    () => activeCategory?.articles?.find((item) => item.id === activeArticleId) || activeCategory?.articles?.[0] || null,
    [activeArticleId, activeCategory]
  );
  const activeArticleIndex = activeCategory?.articles?.findIndex((item) => item.id === activeArticle?.id) ?? -1;
  const activeArticles = activeCategory?.articles || [];
  const previousArticle = activeArticleIndex > 0 ? activeArticles[activeArticleIndex - 1] : null;
  const nextArticle = activeArticleIndex >= 0 && activeArticleIndex < activeArticles.length - 1
    ? activeArticles[activeArticleIndex + 1]
    : null;
  const mobileReaderCategory = mobileReaderArticleId
    ? visibleCategories.find((category) =>
        (category.articles || []).some((article) => article.id === mobileReaderArticleId)
      ) || null
    : null;
  const mobileReaderArticle = mobileReaderCategory?.articles?.find((article) => article.id === mobileReaderArticleId) || null;
  const mobileReaderArticles = mobileReaderCategory?.articles || [];
  const mobileReaderArticleIndex = mobileReaderArticles.findIndex((article) => article.id === mobileReaderArticle?.id);
  const mobileReaderPreviousArticle = mobileReaderArticleIndex > 0 ? mobileReaderArticles[mobileReaderArticleIndex - 1] : null;
  const mobileReaderNextArticle = mobileReaderArticleIndex >= 0 && mobileReaderArticleIndex < mobileReaderArticles.length - 1
    ? mobileReaderArticles[mobileReaderArticleIndex + 1]
    : null;
  const requestedArticleId = mobileReaderArticle?.id || activeArticle?.id || null;
  const articleDetailQuery = useQuery({
    queryKey: tutorialKeys.article(requestedArticleId || "none"),
    queryFn: () => api.get<TutorialArticleResponse>(`/api/tutorials/articles/${requestedArticleId}`, { silent: true }),
    enabled: Boolean(requestedArticleId),
  });
  const articleDetail = articleDetailQuery.data?.article || null;
  const activeArticleWithContent = useMemo(() => {
    if (!activeArticle) return null;
    if (articleDetail?.id === activeArticle.id) {
      return { ...activeArticle, ...articleDetail };
    }
    return { ...activeArticle, contentLoading: articleDetailQuery.isFetching };
  }, [activeArticle, articleDetail, articleDetailQuery.isFetching]);
  const activeArticleSections = useMemo(
    () => buildTutorialSections(activeArticleWithContent?.content || "", activeArticleWithContent?.title || ""),
    [activeArticleWithContent?.content, activeArticleWithContent?.title]
  );
  const [activeSectionId, setActiveSectionId] = useState("");
  const mobileReaderArticleWithContent = useMemo(() => {
    if (!mobileReaderArticle) return null;
    if (articleDetail?.id === mobileReaderArticle.id) {
      return { ...mobileReaderArticle, ...articleDetail };
    }
    return { ...mobileReaderArticle, contentLoading: articleDetailQuery.isFetching };
  }, [mobileReaderArticle, articleDetail, articleDetailQuery.isFetching]);
  const mobileReaderOpen = shouldRenderTutorialReaderOverlay({ isMobile, selectedArticle: mobileReaderArticle });
  const shouldShowTutorialCatalog = shouldRenderTutorialCatalog({ isMobile, readerOpen: mobileReaderOpen });
  const readerScrollTargetSelector = getTutorialReaderScrollTargetSelector(mobileReaderOpen);
  const relatedFunctionArticles = useMemo(
    () => activeArticles.filter((item) => item.id !== activeArticle?.id).slice(0, 6),
    [activeArticle?.id, activeArticles]
  );

  const selectArticle = (category: TutorialCategory, article: TutorialArticle) => {
    setActiveCategoryId(category.id);
    setActiveArticleId(article.id);
    if (isMobile) {
      setMobileReaderArticleId(article.id);
    }
  };

  useEffect(() => {
    if (!mobileReaderArticleId) return;
    const readerArticleStillVisible = visibleCategories.some((category) =>
      (category.articles || []).some((article) => article.id === mobileReaderArticleId)
    );
    if (!readerArticleStillVisible) {
      setMobileReaderArticleId(null);
    }
  }, [mobileReaderArticleId, visibleCategories]);

  useEffect(() => {
    if (!readerScrollTargetSelector) return;
    const frameId = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(readerScrollTargetSelector)?.scrollTo({ top: 0, left: 0 });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [readerScrollTargetSelector, mobileReaderArticle?.id]);

  useEffect(() => {
    setActiveSectionId(activeArticleSections[0]?.id || "");
  }, [activeArticle?.id, activeArticleSections]);

  useEffect(() => {
    if (isMobile || !activeArticleSections.length) return;
    let observer: IntersectionObserver | null = null;
    const frameId = window.requestAnimationFrame(() => {
      const elements = activeArticleSections
        .map((section) => document.getElementById(getTutorialSectionDomId(section.id)))
        .filter((element): element is HTMLElement => Boolean(element));
      if (!elements.length) return;
      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
          const nextId = visible?.target.getAttribute("data-tutorial-section-id");
          if (nextId) {
            setActiveSectionId(nextId);
          }
        },
        { rootMargin: "-120px 0px -55% 0px", threshold: [0.12, 0.35, 0.6] }
      );
      elements.forEach((element) => observer?.observe(element));
    });
    return () => {
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
    };
  }, [activeArticleSections, isMobile]);

  const scrollToArticleSection = useCallback((sectionId: string) => {
    document.getElementById(getTutorialSectionDomId(sectionId))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const renderArticleContent = ({
    article,
    category,
    articleIndex,
    articles,
    previous,
    next,
    onPrevious,
    onNext,
    headingClassName,
  }: {
    article: TutorialArticle | null;
    category: TutorialCategory | null;
    articleIndex: number;
    articles: TutorialArticle[];
    previous: TutorialArticle | null;
    next: TutorialArticle | null;
    onPrevious: () => void;
    onNext: () => void;
    headingClassName: string;
  }) => {
    const sections = article?.id === activeArticleWithContent?.id
      ? activeArticleSections
      : buildTutorialSections(article?.content || "", article?.title || "");

    return (
      <TutorialArticleReader
        article={article}
        category={category}
        articleIndex={articleIndex}
        articles={articles}
        sections={sections}
        previous={previous}
        next={next}
        onPrevious={onPrevious}
        onNext={onNext}
        headingClassName={headingClassName}
      />
    );
  };

  return (
    <LitePageFrame className={`max-w-none bg-[#f8fafc] px-0 py-0 ${getLiteMobileContentPaddingClassName(isMobile)}`}>
      {shouldShowTutorialCatalog ? (
        <>
          <section className="border-b border-emerald-100 bg-white">
            <div className="mx-auto max-w-[1440px] px-5 py-6 sm:px-8">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 transition hover:text-emerald-900"
              >
                <ArrowLeft size={16} />
                返回首页
              </button>
              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end">
                <div>
                  <div className="flex items-center gap-2 text-sm font-black text-emerald-700">
                    <BookOpen size={18} />
                    Excel 教程中心
                  </div>
                  <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                    Excel 函数与公式教程
                  </h1>
                  <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
                    按函数分类学习用法、语法、示例和注意点，阅读后可进入关联章节或题目练习。
                  </p>
                </div>
                <label className="flex h-12 items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 shadow-sm">
                  <Search size={18} className="text-emerald-700" />
                  <input
                    value={searchKeyword}
                    onChange={(event) => setSearchKeyword(event.target.value)}
                    placeholder="搜索教程、函数、场景..."
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="mx-auto grid max-w-[1440px] gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[240px_minmax(720px,1fr)_280px]">
            <div className="lg:hidden">
              <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-700 px-4 py-3 text-sm font-black text-white">
                  <ListTree size={16} />
                  教程目录
                </div>
                <div className="divide-y divide-slate-100">
                  {visibleCategories.map((category) => {
                    const isExpanded = category.id === expandedMobileCategoryId;
                    return (
                      <div key={`mobile-category-${category.id}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedMobileCategoryId(isExpanded ? null : category.id);
                            setActiveCategoryId(category.id);
                            setActiveArticleId(category.articles?.[0]?.id || null);
                          }}
                          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left text-sm font-black text-slate-800 transition hover:bg-emerald-50"
                        >
                          <span>{category.name}</span>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
                            {category.articles?.length || 0}
                          </span>
                        </button>
                        {isExpanded ? (
                          <div className="bg-slate-50 px-3 pb-3">
                            {(category.articles || []).map((article) => (
                              <button
                                key={`mobile-article-${article.id}`}
                                type="button"
                                onClick={() => selectArticle(category, article)}
                                className="mt-2 flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50"
                              >
                                <FileText size={16} className="shrink-0 text-emerald-600" />
                                <span className="min-w-0 flex-1 truncate">{article.title}</span>
                                <ArrowRight size={15} className="shrink-0 text-slate-400" />
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {!visibleCategories.length ? (
                    <div className="px-4 py-6 text-sm text-slate-400">
                      {tutorialsQuery.isLoading ? "教程加载中..." : "暂无匹配教程"}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <FunctionSidebar
              categories={visibleCategories}
              activeCategory={activeCategory}
              activeArticle={activeArticle}
              loading={tutorialsQuery.isLoading}
              onSelectCategory={(category) => {
                setActiveCategoryId(category.id);
                setActiveArticleId(category.articles?.[0]?.id || null);
              }}
              onSelectArticle={selectArticle}
            />

            {shouldRenderTutorialInlineArticle(isMobile) ? (
              <article className="min-w-0">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 font-bold text-slate-500">
                    <span>Excel 教程</span>
                    <span>/</span>
                    <span>{activeCategory?.name || "请选择分类"}</span>
                  </div>
                  {activeArticle ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
                      {activeArticleIndex + 1}/{activeArticles.length}
                    </span>
                  ) : null}
                </div>

                <div className="lesson-content max-w-[860px]">
                  {activeArticleWithContent ? (
                    renderArticleContent({
                      article: activeArticleWithContent,
                      category: activeCategory,
                      articleIndex: activeArticleIndex,
                      articles: activeArticles,
                      previous: previousArticle,
                      next: nextArticle,
                      onPrevious: () => previousArticle && setActiveArticleId(previousArticle.id),
                      onNext: () => nextArticle && setActiveArticleId(nextArticle.id),
                      headingClassName: "text-4xl font-black tracking-tight text-slate-950",
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-16 text-center text-sm text-slate-400">
                      {tutorialsQuery.isLoading ? "教程内容加载中..." : "暂无匹配教程内容"}
                    </div>
                  )}
                </div>
              </article>
            ) : null}

            <TutorialAside
              article={activeArticle}
              sections={activeArticleSections}
              activeSectionId={activeSectionId}
              relatedArticles={relatedFunctionArticles}
              onStartPractice={() => {
                if (activeArticle?.relatedQuestions?.[0]) {
                  navigate(`/practice/question/${activeArticle.relatedQuestions[0].id}`, { state: { backTo: "/tutorials" } });
                  return;
                }
                if (activeArticle?.relatedChapters?.[0]) {
                  navigate(`/practice/chapter/${activeArticle.relatedChapters[0].id}`);
                }
              }}
              onSelectSection={scrollToArticleSection}
              onSelectRelated={(article) => activeCategory && selectArticle(activeCategory, article)}
            />
          </section>
        </>
      ) : null}

      {mobileReaderOpen ? (
        <section className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
          <div className="sticky top-0 z-10 -mx-4 border-b border-emerald-100 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileReaderArticleId(null)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700"
                aria-label="返回教程目录"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-emerald-700">教程阅读</div>
                <div className="truncate text-sm font-bold text-slate-900">
                  {mobileReaderCategory?.name || "教程中心"}
                </div>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                {mobileReaderArticleIndex + 1}/{mobileReaderArticles.length}
              </span>
            </div>
          </div>
          <article className="my-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="px-4 py-6">
              {renderArticleContent({
                article: mobileReaderArticleWithContent,
                category: mobileReaderCategory,
                articleIndex: mobileReaderArticleIndex,
                articles: mobileReaderArticles,
                previous: mobileReaderPreviousArticle,
                next: mobileReaderNextArticle,
                onPrevious: () => {
                  if (!mobileReaderPreviousArticle || !mobileReaderCategory) return;
                  setActiveCategoryId(mobileReaderCategory.id);
                  setActiveArticleId(mobileReaderPreviousArticle.id);
                  setMobileReaderArticleId(mobileReaderPreviousArticle.id);
                },
                onNext: () => {
                  if (!mobileReaderNextArticle || !mobileReaderCategory) return;
                  setActiveCategoryId(mobileReaderCategory.id);
                  setActiveArticleId(mobileReaderNextArticle.id);
                  setMobileReaderArticleId(mobileReaderNextArticle.id);
                },
                headingClassName: "text-3xl font-black leading-tight tracking-tight text-slate-950",
              })}
            </div>
          </article>
        </section>
      ) : null}
    </LitePageFrame>
  );
}

type TutorialSectionKind = "intro" | "syntax" | "data" | "target" | "formula" | "breakdown" | "pitfall" | "exercise" | "default";

type TutorialSection = {
  id: string;
  title: string;
  kind: TutorialSectionKind;
  html: string;
  formulas: string[];
};

function TutorialArticleReader({
  article,
  category,
  articleIndex,
  articles,
  sections,
  previous,
  next,
  onPrevious,
  onNext,
  headingClassName,
}: {
  article: TutorialArticle | null;
  category: TutorialCategory | null;
  articleIndex: number;
  articles: TutorialArticle[];
  sections: TutorialSection[];
  previous: TutorialArticle | null;
  next: TutorialArticle | null;
  onPrevious: () => void;
  onNext: () => void;
  headingClassName: string;
}) {
  return (
    <>
      <TutorialHero
        article={article}
        category={category}
        titleClassName={headingClassName}
      />

      {article.contentLoading ? (
        <div className="rounded-[14px] border border-dashed border-slate-200 bg-white px-6 py-10 text-sm text-slate-400 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          教程内容加载中...
        </div>
      ) : sections.length ? (
        <div className="space-y-5">
          {sections.map((section) => (
            <TutorialSectionCard key={section.id} section={section} />
          ))}
        </div>
      ) : (
        <div className="rounded-[14px] border border-dashed border-slate-200 bg-white px-6 py-10 text-sm text-slate-400 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          当前教程暂无正文内容。
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={!previous}
          onClick={onPrevious}
          className="flex min-h-16 items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-600 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition enabled:hover:border-emerald-300 enabled:hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <span>上一篇</span>
          <span className="truncate">{previous?.title || "无"}</span>
        </button>
        <button
          type="button"
          disabled={!next}
          onClick={onNext}
          className="flex min-h-16 items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-600 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition enabled:hover:border-emerald-300 enabled:hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <span>下一篇</span>
          <span className="truncate">{next?.title || "无"}</span>
        </button>
      </div>

      <div className="sr-only">
        {category?.name || "教程分类"} {articleIndex + 1}/{articles.length}
      </div>
    </>
  );
}

function TutorialHero({
  article,
  category,
  titleClassName,
}: {
  article: TutorialArticle | null;
  category: TutorialCategory | null;
  titleClassName: string;
}) {
  const heroTags = buildHeroTags(article, category);

  return (
    <section className="mb-6 rounded-2xl border border-emerald-100 bg-[linear-gradient(135deg,#f0fdf4,#ffffff)] p-6 shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
      <div className="max-w-3xl">
        <div className="min-w-0">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-black text-emerald-700">
            <BookOpen size={14} />
            在线课程
          </div>
          <h1 className={titleClassName}>{getArticleFunctionName(article)}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            {article.oneLineUsage || article.summary || "围绕函数用法、语法、示例和练习建立完整学习路径。"}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {heroTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TutorialSectionCard({ section }: { section: TutorialSection }) {
  const Icon = getSectionIcon(section.kind);

  return (
    <section
      id={getTutorialSectionDomId(section.id)}
      data-tutorial-section-id={section.id}
      className="scroll-mt-28 rounded-[14px] border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
          <Icon size={18} strokeWidth={2} />
        </span>
        <h2 className="text-[18px] font-semibold leading-6 text-slate-950">{section.title}</h2>
      </div>

      <div className="mt-5 space-y-4">
        {section.formulas.map((formula) => (
          <FormulaBlock key={formula} formula={formula} />
        ))}
        {section.html ? (
          <div
            className="home-tutorial-content course-tutorial-content text-[15px] leading-7 text-slate-700"
            dangerouslySetInnerHTML={{ __html: section.html }}
          />
        ) : null}
      </div>
    </section>
  );
}

function FormulaBlock({ formula }: { formula: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyTextToClipboard(formula);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[15px] leading-7 text-emerald-950">
          {formula}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 text-xs font-bold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
        >
          <Copy size={14} />
          {copied ? "已复制" : "复制"}
        </button>
      </div>
    </div>
  );
}

function FunctionSidebar({
  categories,
  activeCategory,
  activeArticle,
  loading,
  onSelectCategory,
  onSelectArticle,
}: {
  categories: TutorialCategory[];
  activeCategory: TutorialCategory | null;
  activeArticle: TutorialArticle | null;
  loading: boolean;
  onSelectCategory: (category: TutorialCategory) => void;
  onSelectArticle: (category: TutorialCategory, article: TutorialArticle) => void;
}) {
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Record<string, boolean>>({});

  const toggleCategory = (category: TutorialCategory) => {
    if (category.id !== activeCategory?.id) {
      onSelectCategory(category);
    }
    setExpandedCategoryIds((previous) => ({
      ...previous,
      [category.id]: !previous[category.id],
    }));
  };

  return (
    <aside className="hidden lg:sticky lg:top-[88px] lg:block lg:self-start">
      <nav className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-black text-slate-950">
          <ListTree size={16} className="text-emerald-700" />
          函数目录
        </div>
        <div className="max-h-[calc(100vh-112px)] overflow-y-auto p-3">
          {categories.map((category) => {
            const isActiveCategory = category.id === activeCategory?.id;
            const isExpanded = Boolean(expandedCategoryIds[category.id]);
            return (
              <div key={category.id} className="mb-4 last:mb-0">
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  aria-expanded={isExpanded}
                  className={`mb-2 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-black transition ${
                    isActiveCategory ? "text-emerald-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{category.name}</span>
                  <span className="ml-2 inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-slate-400">
                    {category.articles?.length || 0}
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </button>
                {isExpanded ? (
                  <div className="space-y-1">
                    {(category.articles || []).map((article) => {
                      const isActiveArticle = article.id === activeArticle?.id;
                      return (
                        <button
                          key={article.id}
                          type="button"
                          onClick={() => onSelectArticle(category, article)}
                          className={`block w-full rounded-r-lg px-3 py-2 text-left text-sm transition ${
                            isActiveArticle
                              ? "border-l-[3px] border-green-500 bg-green-100 pl-[9px] font-semibold text-green-800"
                              : "border-l-[3px] border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                          }`}
                        >
                          <span className="block truncate">{article.title}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
          {!categories.length ? (
            <div className="px-2 py-6 text-sm text-slate-400">
              {loading ? "教程加载中..." : "暂无匹配教程"}
            </div>
          ) : null}
        </div>
      </nav>
    </aside>
  );
}

function TutorialAside({
  article,
  sections,
  activeSectionId,
  relatedArticles,
  onStartPractice,
  onSelectSection,
  onSelectRelated,
}: {
  article: TutorialArticle | null;
  sections: TutorialSection[];
  activeSectionId: string;
  relatedArticles: TutorialArticle[];
  onStartPractice: () => void;
  onSelectSection: (sectionId: string) => void;
  onSelectRelated: (article: TutorialArticle) => void;
}) {
  const relatedQuestionCount = article?.relatedQuestions?.length || 0;
  const hasPractice = relatedQuestionCount > 0 || (article?.relatedChapters?.length || 0) > 0;

  return (
    <aside className="hidden space-y-5 lg:sticky lg:top-[88px] lg:block lg:self-start">
      <section className="rounded-[14px] border border-emerald-100 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <GraduationCap size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-950">配套练习</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {hasPractice
                ? relatedQuestionCount > 0
                  ? `${relatedQuestionCount} 道题 · 约 ${Math.max(5, relatedQuestionCount * 2)} 分钟`
                  : "关联章节 · 约 5 分钟"
                : "暂无配套练习"}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={!hasPractice}
          onClick={onStartPractice}
          className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-[10px] bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          {hasPractice ? "开始练习" : "暂无配套练习"}
        </button>
      </section>

      <section className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <h3 className="text-sm font-black text-slate-950">本篇目录</h3>
        <div className="mt-3 space-y-1">
          {sections.map((section) => {
            const isActive = section.id === activeSectionId;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSelectSection(section.id)}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  isActive ? "bg-emerald-50 font-semibold text-emerald-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                {section.title}
              </button>
            );
          })}
          {!sections.length ? <div className="py-2 text-sm text-slate-400">暂无目录</div> : null}
        </div>
      </section>

      <section className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <h3 className="text-sm font-black text-slate-950">相关函数</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {relatedArticles.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectRelated(item)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
            >
              {getFunctionDisplayName(item)}
            </button>
          ))}
          {!relatedArticles.length ? <span className="text-sm text-slate-400">暂无相关函数</span> : null}
        </div>
      </section>
    </aside>
  );
}

export function buildTutorialSections(content: string, articleTitle: string): TutorialSection[] {
  const html = normalizeTutorialContent(content);
  if (!html) return [];

  if (typeof DOMParser === "undefined") {
    return [{
      id: "section-1",
      title: "函数简介",
      kind: "intro",
      html,
      formulas: [],
    }];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div data-tutorial-root="true">${html}</div>`, "text/html");
  const root = doc.body.querySelector('[data-tutorial-root="true"]');
  if (!root) return [];

  sanitizeTutorialRoot(root);

  const rawSections: Array<{ title: string; nodes: ChildNode[] }> = [];
  let currentTitle: string | null = null;
  let currentNodes: ChildNode[] = [];
  const flush = () => {
    if (!currentTitle && !hasMeaningfulNodes(currentNodes)) {
      currentNodes = [];
      return;
    }
    const title = normalizeSectionTitle(currentTitle || inferSectionTitle(articleTitle, rawSections.length));
    rawSections.push({ title, nodes: currentNodes.map((node) => node.cloneNode(true) as ChildNode) });
    currentNodes = [];
  };

  Array.from(root.childNodes).forEach((node) => {
    if (isSectionHeading(node)) {
      flush();
      currentTitle = normalizeSectionTitle(node.textContent || "");
      currentNodes = [];
      return;
    }
    currentNodes.push(node.cloneNode(true) as ChildNode);
  });
  flush();

  return rawSections
    .map((section, index) => {
      const wrapper = doc.createElement("div");
      section.nodes.forEach((node) => wrapper.appendChild(node.cloneNode(true)));
      const formulas = extractFormulaNodes(wrapper);
      decorateTutorialTables(wrapper, doc);
      removeEmptyTutorialNodes(wrapper);
      return {
        id: `section-${index + 1}`,
        title: section.title,
        kind: getSectionKind(section.title),
        html: wrapper.innerHTML.trim(),
        formulas,
      };
    })
    .filter((section) => section.html || section.formulas.length);
}

function normalizeTutorialContent(content: string) {
  const trimmed = (content || "").trim();
  if (!trimmed) return "";
  if (looksLikeHtml(trimmed)) return sanitizeRichHtml(trimmed);
  return renderRichContent(trimmed);
}

function sanitizeTutorialRoot(root: Element) {
  root.innerHTML = sanitizeRichHtml(root.innerHTML);
}

function isSectionHeading(node: ChildNode): node is HTMLElement {
  return node.nodeType === Node.ELEMENT_NODE && /^h[1-4]$/i.test((node as HTMLElement).tagName);
}

function hasMeaningfulNodes(nodes: ChildNode[]) {
  return nodes.some((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return Boolean(node.textContent?.trim());
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }
    const element = node as HTMLElement;
    return Boolean(element.textContent?.trim()) || /^(img|table|pre|blockquote)$/i.test(element.tagName);
  });
}

function normalizeSectionTitle(value: string) {
  const title = value.replace(/\s+/g, " ").replace(/[：:]\s*$/, "").trim();
  if (!title) return "函数简介";
  const match = sectionTitleAliases.find((item) => item.pattern.test(title));
  return match?.title || title;
}

function inferSectionTitle(articleTitle: string, index: number) {
  if (index === 0) return "函数简介";
  return articleTitle ? `${articleTitle}说明` : "教程内容";
}

function getSectionKind(title: string): TutorialSectionKind {
  if (/语法|参数|写法/.test(title)) return "syntax";
  if (/原始|示例数据|数据区|数据源|表格/.test(title)) return "data";
  if (/目标|结果|输出/.test(title)) return "target";
  if (/公式.*(解释|说明)|拆解|解析|原理/.test(title)) return "breakdown";
  if (/公式/.test(title)) return "formula";
  if (/常见|注意|坑|错误/.test(title)) return "pitfall";
  if (/练习|实战|训练/.test(title)) return "exercise";
  if (/简介|概念|是什么|用途|用法/.test(title)) return "intro";
  return "default";
}

function getSectionIcon(kind: TutorialSectionKind) {
  const icons = {
    intro: BookOpen,
    syntax: Code2,
    data: Table2,
    target: Target,
    formula: Calculator,
    breakdown: ListChecks,
    pitfall: AlertTriangle,
    exercise: GraduationCap,
    default: FileText,
  };
  return icons[kind];
}

function extractFormulaNodes(wrapper: HTMLElement) {
  const formulas: string[] = [];
  const addFormula = (value: string) => {
    const formula = cleanFormulaText(value);
    if (!formula || !isFormulaLike(formula) || formulas.includes(formula)) return false;
    formulas.push(formula);
    return true;
  };
  const removeFormulaElement = (element: Element) => {
    let target: Element = element;
    if (element.parentElement?.tagName.toLowerCase() === "pre") {
      target = element.parentElement;
    }
    const parent = target.parentElement;
    if (parent && /^(p|div)$/i.test(parent.tagName) && parent.textContent?.trim() === target.textContent?.trim() && parent.children.length === 1) {
      parent.remove();
      return;
    }
    target.remove();
  };

  Array.from(wrapper.querySelectorAll("pre, code")).forEach((element) => {
    if (!element.isConnected) return;
    if (addFormula(element.textContent || "")) {
      removeFormulaElement(element);
    }
  });

  Array.from(wrapper.querySelectorAll("p, li")).forEach((element) => {
    if (!element.isConnected) return;
    const text = cleanFormulaText(element.textContent || "");
    if (text.length <= 180 && addFormula(text)) {
      element.remove();
    }
  });

  return formulas;
}

function cleanFormulaText(value: string) {
  const normalized = value
    .replace(/\u00a0/g, " ")
    .replace(/^(核心公式|公式|示例公式|函数公式)[：:]\s*/i, "")
    .trim();
  const formulaLine = normalized.split(/\n+/).map((line) => line.trim()).find((line) => line.startsWith("="));
  return formulaLine || normalized;
}

function isFormulaLike(value: string) {
  return /^=\S+/.test(value.trim());
}

function decorateTutorialTables(wrapper: HTMLElement, doc: Document) {
  Array.from(wrapper.querySelectorAll("table")).forEach((table) => {
    table.classList.add("tutorial-excel-table-grid");
    Array.from(table.querySelectorAll("td")).forEach((cell) => {
      const text = (cell.textContent || "").trim();
      if (text.startsWith("=")) {
        cell.classList.add("tutorial-excel-formula-cell");
      }
    });

    const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
    const lastRow = bodyRows[bodyRows.length - 1];
    const lastRowCells = lastRow ? Array.from(lastRow.querySelectorAll("td")) : [];
    const lastCell = lastRowCells[lastRowCells.length - 1];
    if (lastCell && bodyRows.length > 1) {
      lastCell.classList.add("tutorial-excel-result-cell");
    }

    const parent = table.parentElement;
    const alreadyWrapped = Boolean(parent?.hasAttribute("data-table-wrapper") || parent?.classList.contains("tutorial-excel-table-wrap"));
    const tableWrap = alreadyWrapped && parent ? parent : doc.createElement("div");
    tableWrap.classList.add("tutorial-excel-table-wrap");
    if (!alreadyWrapped) {
      table.parentNode?.insertBefore(tableWrap, table);
      tableWrap.appendChild(table);
    }
    const previous = tableWrap.previousElementSibling;
    if (!previous?.classList.contains("tutorial-excel-table-title")) {
      const title = doc.createElement("div");
      title.className = "tutorial-excel-table-title";
      title.textContent = "示例数据";
      tableWrap.parentNode?.insertBefore(title, tableWrap);
    }
  });
}

function removeEmptyTutorialNodes(wrapper: HTMLElement) {
  Array.from(wrapper.querySelectorAll("p, div")).forEach((element) => {
    if (element.children.length === 0 && !element.textContent?.trim()) {
      element.remove();
    }
  });
}

function getTutorialSectionDomId(sectionId: string) {
  return `tutorial-${sectionId}`;
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back for preview environments where clipboard permission is restricted.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function buildHeroTags(article: TutorialArticle | null, category: TutorialCategory | null) {
  const tags = [
    category?.name,
    article?.audienceTrack ? trackLabel[article.audienceTrack] || "通用轨道" : null,
    article?.difficulty ? `${difficultyLabel[article.difficulty] || "基础"}函数` : "基础函数",
    `约 ${estimateReadingMinutes(article?.content || article?.summary || "")} 分钟`,
  ].filter(Boolean) as string[];
  return Array.from(new Set(tags)).slice(0, 4);
}

function estimateReadingMinutes(content: string) {
  const text = stripRichContent(content || "");
  return Math.max(3, Math.ceil(text.length / 420));
}

function getArticleFunctionName(article: TutorialArticle | null) {
  const title = String(article?.title || "Excel 函数").trim();
  if (/^[a-z0-9_.]+$/i.test(title)) return `${title.toUpperCase()} 函数`;
  return title;
}

function getFunctionDisplayName(article: TutorialArticle | null) {
  const title = String(article?.title || "").trim();
  return title.replace(/\s*函数(?:教程|详解|说明)?$/i, "") || title;
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

const sectionTitleAliases = [
  { pattern: /语法|参数|写法/, title: "语法说明" },
  { pattern: /原始|示例数据|数据区|数据源|表格/, title: "原始数据区" },
  { pattern: /目标|结果|输出/, title: "目标结果" },
  { pattern: /公式.*(解释|说明)|拆解|解析|原理/, title: "公式拆解" },
  { pattern: /核心公式|公式/, title: "核心公式" },
  { pattern: /常见|注意|坑|错误/, title: "常见坑" },
  { pattern: /练习|实战|训练/, title: "配套练习" },
  { pattern: /简介|概念|是什么|用途|用法/, title: "函数简介" },
];

const trackLabel: Record<string, string> = {
  beginner: "新手入门",
  advanced: "进阶提升",
  general: "通用轨道",
};

const difficultyLabel: Record<string, string> = {
  basic: "基础",
  medium: "中等",
  advanced: "进阶",
};
