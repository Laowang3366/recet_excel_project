import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "./ui/utils";

type LitePageFrameProps = {
  children: ReactNode;
  className?: string;
};

type LiteHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
  contentClassName?: string;
  accentClassName?: string;
};

type LiteSectionTitleProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function LitePageFrame({ children, className }: LitePageFrameProps) {
  return (
    <div className={cn("relative mx-auto max-w-[1408px] px-4 py-5 sm:px-6 sm:py-8", className)}>
      <div className="pointer-events-none absolute inset-x-4 top-0 -z-10 h-[520px] rounded-[44px] bg-[radial-gradient(circle_at_20%_0%,rgba(0,176,80,0.30),transparent_34%),radial-gradient(circle_at_78%_8%,rgba(34,197,94,0.16),transparent_30%),linear-gradient(180deg,rgba(0,20,13,0.96),rgba(0,59,38,0.40)_58%,rgba(244,255,248,0))] blur-2xl sm:inset-x-6" />
      <div className="space-y-8 sm:space-y-10">{children}</div>
    </div>
  );
}

export function LiteHero({
  eyebrow,
  title,
  description,
  actions,
  aside,
  className,
  contentClassName,
  accentClassName,
}: LiteHeroProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-[34px] border border-white/10 bg-[#00140d] px-6 py-8 text-white shadow-[0_34px_90px_rgba(0,20,13,0.28)] sm:px-8 sm:py-10",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(0,176,80,0.42)_0%,rgba(34,197,94,0.18)_28%,transparent_50%),radial-gradient(circle_at_82%_18%,rgba(124,255,178,0.20),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:100%_8px]" />
      <div className="pointer-events-none absolute -right-16 top-0 h-64 w-64 rounded-full bg-[#00b050]/25 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 bottom-0 h-44 w-44 rounded-full bg-[#7cffb2]/12 blur-3xl" />
      <div
        className={cn(
          "relative grid gap-8",
          aside ? "lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)] lg:items-end" : undefined
        )}
      >
        <div className={cn("max-w-3xl", contentClassName)}>
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/8 px-4 py-2 text-[12px] font-bold tracking-[0.14em] text-white/86 backdrop-blur-sm",
              accentClassName
            )}
          >
            <span className="h-2 w-2 rounded-full bg-[#00e0a4] opacity-90" />
            {eyebrow}
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight text-white sm:text-6xl sm:leading-[0.98]">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-white/66 sm:text-[18px]">
            {description}
          </p>
          {actions ? <div className="mt-7 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? <div className="relative">{aside}</div> : null}
      </div>
    </motion.section>
  );
}

export function LiteSectionTitle({
  eyebrow,
  title,
  description,
  action,
  className,
}: LiteSectionTitleProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        {eyebrow ? (
          <div className="text-[12px] font-black uppercase tracking-[0.2em] text-[#00b050]">{eyebrow}</div>
        ) : null}
        <h2 className="mt-2 text-[30px] font-black tracking-tight text-slate-950 sm:text-[42px]">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function LitePanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-slate-200/70 bg-white p-5 shadow-[0_20px_54px_rgba(15,23,42,0.07)] backdrop-blur-xl sm:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}
