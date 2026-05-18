import type { ReactNode } from "react";

export type MobileBottomNavItem = {
  key: string;
  name: string;
  path: string;
  icon: ReactNode;
};

type MobileBottomNavProps = {
  isMobile: boolean;
  items: MobileBottomNavItem[];
  pathname: string;
  onNavigate: (path: string) => void;
};

export function MobileBottomNav({ isMobile, items, pathname, onNavigate }: MobileBottomNavProps) {
  if (!isMobile) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
      <div className="grid grid-cols-4 gap-1">
        {items.map((item) => {
          const isActive = pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path));
          return (
            <button
              key={`mobile-nav-${item.key}`}
              type="button"
              onClick={() => onNavigate(item.path)}
              className={`relative flex min-h-[58px] min-w-[64px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
                isActive
                  ? "bg-teal-50 text-teal-700"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <span className={isActive ? "text-teal-600" : "text-slate-400"}>{item.icon}</span>
              <span className="leading-tight">{item.name}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
