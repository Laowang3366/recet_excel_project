import { Search, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import {
  buildModuleSearchPath,
  getHeaderSearchModule,
  getModuleSearchKeyword,
  resolveHeaderSearchModule,
  type HeaderSearchModuleKey,
} from "../../lib/module-search";

type ModuleSearchProps = {
  pathname?: string;
  moduleKey?: HeaderSearchModuleKey;
  search: string;
  onNavigate: (path: string) => void;
  className?: string;
};

export function ModuleSearch({ pathname, moduleKey, search, onNavigate, className }: ModuleSearchProps) {
  const module = moduleKey ? getHeaderSearchModule(moduleKey) : pathname ? resolveHeaderSearchModule(pathname) : null;
  const [keyword, setKeyword] = useState(() => getModuleSearchKeyword(search));

  useEffect(() => {
    setKeyword(getModuleSearchKeyword(search));
  }, [search, module?.key]);

  if (!module) {
    return null;
  }

  const submitSearch = (nextKeyword = keyword) => {
    onNavigate(buildModuleSearchPath(module.key, nextKeyword, search));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitSearch();
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label={module.label}
      className={`flex min-w-0 items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus-within:border-[#7cffb2]/70 focus-within:bg-white/12 ${className || ""}`}
    >
      <Search size={17} className="shrink-0 text-[#7cffb2]" />
      <input
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder={module.placeholder}
        className="h-11 min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-white/38"
      />
      {keyword ? (
        <button
          type="button"
          onClick={() => {
            setKeyword("");
            submitSearch("");
          }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/42 transition hover:bg-white/12 hover:text-white"
          aria-label="清空搜索"
        >
          <X size={15} />
        </button>
      ) : null}
    </form>
  );
}
