export type HeaderSearchModuleKey = "practice" | "templates";

export type HeaderSearchModule = {
  key: HeaderSearchModuleKey;
  path: string;
  label: string;
  placeholder: string;
};

const SEARCH_MODULES: Record<HeaderSearchModuleKey, HeaderSearchModule> = {
  practice: {
    key: "practice",
    path: "/practice",
    label: "小试牛刀搜索",
    placeholder: "搜索章节或题目",
  },
  templates: {
    key: "templates",
    path: "/templates",
    label: "模板搜索",
    placeholder: "搜索模板、行业或函数",
  },
};

export function getHeaderSearchModule(moduleKey: HeaderSearchModuleKey): HeaderSearchModule {
  return SEARCH_MODULES[moduleKey];
}

export function resolveHeaderSearchModule(pathname: string): HeaderSearchModule | null {
  const normalizedPathname = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  if (normalizedPathname === "/practice" || normalizedPathname.startsWith("/practice/")) {
    return SEARCH_MODULES.practice;
  }
  if (normalizedPathname === "/templates" || normalizedPathname.startsWith("/templates/")) {
    return SEARCH_MODULES.templates;
  }
  return null;
}

export function buildModuleSearchPath(moduleKey: HeaderSearchModuleKey, keyword: string, currentSearch: string) {
  const module = SEARCH_MODULES[moduleKey];
  const params = new URLSearchParams(currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch);
  const trimmedKeyword = keyword.trim();
  if (trimmedKeyword) {
    params.set("search", trimmedKeyword);
  } else {
    params.delete("search");
  }
  const query = params.toString();
  return `${module.path}${query ? `?${query}` : ""}`;
}

export function getModuleSearchKeyword(currentSearch: string) {
  const params = new URLSearchParams(currentSearch.startsWith("?") ? currentSearch.slice(1) : currentSearch);
  return params.get("search") || "";
}
