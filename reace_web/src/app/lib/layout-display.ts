export function getAppShellClassName() {
  return "relative flex h-dvh overflow-hidden bg-[#00140d] text-slate-900 font-sans";
}

export function shouldRenderCompactHeaderAccountAction({
  onlineLiteMode,
  isMobile,
}: {
  onlineLiteMode: boolean;
  isMobile: boolean;
}) {
  return onlineLiteMode && isMobile;
}

export function shouldRenderCompactHeaderNotificationAction({
  onlineLiteMode,
  isMobile,
}: {
  onlineLiteMode: boolean;
  isMobile: boolean;
}) {
  return onlineLiteMode && isMobile;
}

export function shouldRenderHeaderDrawerTrigger({
  isMobile,
}: {
  onlineLiteMode: boolean;
  isMobile: boolean;
}) {
  return isMobile;
}

export function getLitePublicNavigationClassName() {
  return "hidden min-w-0 items-center gap-1 md:ml-[clamp(56px,10vw,260px)] md:flex";
}

export function getLiteCategorySearchClassName() {
  return "relative hidden xl:block";
}

export function getMobileBottomNavigationReserveClassName() {
  return "pb-[calc(176px+env(safe-area-inset-bottom))]";
}

export function getMobileBottomNavigationContentClassName(isMobile: boolean) {
  return isMobile ? `h-full ${getMobileBottomNavigationReserveClassName()}` : "h-full";
}

export function getCompactHeaderAccountButtonClassName() {
  return "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/18 bg-white/10 p-1 transition hover:border-white/34 hover:bg-white/16";
}

export function getCompactHeaderNotificationButtonClassName() {
  return "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/18 bg-white/10 text-white transition hover:border-white/34 hover:bg-white/16";
}
