import { Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { getLiteCategorySearchClassName } from "../../lib/layout-display";

type CategorySearchScope = "tutorial" | "question";

type CategorySearchProps = {
  onNavigate: (path: string) => void;
};

export function CategorySearch({ onNavigate }: CategorySearchProps) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<CategorySearchScope>("tutorial");
  const [keyword, setKeyword] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = () => {
    const trimmed = keyword.trim();
    const query = trimmed ? `?search=${encodeURIComponent(trimmed)}` : "";
    setOpen(false);
    onNavigate(scope === "tutorial" ? `/tutorials${query}` : `/practice${query}`);
  };

  return (
    <div className={getLiteCategorySearchClassName()} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 text-sm font-bold text-white/82 transition hover:bg-white/14 hover:text-white xl:px-4"
      >
        <Search size={17} className="text-[#7cffb2]" />
        <span className="whitespace-nowrap">分类搜索</span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 top-full z-50 mt-3 w-[360px] overflow-hidden rounded-[26px] border border-white/12 bg-[#06251a]/96 p-4 shadow-[0_24px_64px_rgba(0,0,0,0.34)] backdrop-blur-xl"
          >
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "tutorial", label: "教程" },
                { key: "question", label: "题型" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setScope(item.key as CategorySearchScope)}
                  className={`h-10 rounded-2xl text-sm font-black transition ${
                    scope === item.key
                      ? "bg-[#7cffb2] text-[#00140d]"
                      : "bg-white/8 text-white/62 hover:bg-white/12 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="mt-3 flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4">
              <Search size={18} className="text-white/42" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleSearch();
                  }
                }}
                placeholder={scope === "tutorial" ? "搜索函数、教程主题..." : "搜索章节、题型..."}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/36"
              />
            </label>
            <button
              type="button"
              onClick={handleSearch}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#00b050] text-sm font-black text-white transition hover:bg-[#0ac45d]"
            >
              进入搜索
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
