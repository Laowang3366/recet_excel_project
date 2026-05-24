import { useEffect, useState } from "react";
import { Clock3, LoaderCircle, Trash2, WandSparkles } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { FormulaExplainResult } from "../components/tools/FormulaExplainResult";
import { LiteHero, LitePageFrame, LitePanel } from "../components/LiteSurface";
import { buildCurrentAuthRedirectPath } from "../lib/auth-redirect";
import {
  validateFormulaInput,
  type FormulaExplainRequest,
} from "../lib/formula-explainer";
import {
  getFormulaExplainTaskSnapshot,
  resetFormulaExplainTask,
  startFormulaExplainTask,
  useFormulaExplainTask,
} from "../lib/formula-explain-task";
import { useSession } from "../lib/session";

const exampleFormulas = [
  {
    name: "XLOOKUP",
    formula: "=IFERROR(XLOOKUP(A2,客户表[手机号],客户表[姓名]),\"未找到\")",
  },
  {
    name: "SUMIFS",
    formula: "=SUMIFS(销售额,区域,F2,月份,G2)",
  },
  {
    name: "FILTER",
    formula: "=FILTER(A2:D100,D2:D100=\"已成交\")",
  },
  {
    name: "LET",
    formula: "=LET(data,A2:A100,FILTER(data,data<>\"\"))",
  },
];

export function Tools() {
  const navigate = useNavigate();
  const { isAuthenticated } = useSession();
  const initialTask = getFormulaExplainTaskSnapshot();
  const [formula, setFormula] = useState(initialTask.request?.formula || "");
  const formulaTask = useFormulaExplainTask();
  const result = formulaTask.result || null;
  const isExplainPending = formulaTask.status === "pending";

  useEffect(() => {
    if (!formulaTask.taskId || !formulaTask.request) return;
    setFormula(formulaTask.request.formula || "");
  }, [formulaTask.taskId, formulaTask.request]);

  const handleExplain = () => {
    if (!isAuthenticated) {
      navigate(buildCurrentAuthRedirectPath());
      return;
    }
    const validation = validateFormulaInput(formula);
    if (!validation.ok) {
      toast.info(validation.message);
      return;
    }
    const payload: FormulaExplainRequest = {
      formula,
      locale: "zh-CN",
      detailLevel: "standard",
    };
    void startFormulaExplainTask(payload).catch(() => undefined);
  };

  const applyExample = (value: string) => {
    setFormula(value);
    resetFormulaExplainTask();
  };

  return (
    <LitePageFrame>
      <LiteHero
        eyebrow="实用工具"
        title="函数公式解释器"
        description="粘贴 Excel 公式后生成中文解释、分段说明、函数含义、注意事项和优化建议。"
        contentClassName="lg:self-start"
        actions={
          <>
            <button
              type="button"
              onClick={handleExplain}
              disabled={isExplainPending}
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-slate-900 disabled:cursor-not-allowed disabled:bg-white/60"
            >
              {isExplainPending ? <LoaderCircle size={16} className="animate-spin" /> : <WandSparkles size={16} />}
              {isExplainPending ? "后台解释中..." : "解释公式"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/tools/formula-history")}
              className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-6 py-3 text-sm font-bold text-white"
            >
              <Clock3 size={16} />
              公式历史
            </button>
            <button
              type="button"
              onClick={() => {
                setFormula("");
                resetFormulaExplainTask();
              }}
              disabled={isExplainPending}
              className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={16} />
              清空
            </button>
          </>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <LitePanel>
          <h2 className="mb-4 text-base font-black text-slate-900">输入公式</h2>
          <textarea
            value={formula}
            onChange={(event) => {
              setFormula(event.target.value);
              resetFormulaExplainTask();
            }}
            disabled={isExplainPending}
            spellCheck={false}
            className="min-h-[220px] w-full resize-y rounded-[26px] border border-slate-200 bg-slate-50 px-5 py-4 font-mono text-sm leading-7 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-70"
            placeholder="输入或粘贴需要解释的 Excel 公式"
          />
          <div className="mt-5 flex flex-wrap gap-2">
            {exampleFormulas.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => applyExample(item.formula)}
                disabled={isExplainPending}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {item.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleExplain}
            disabled={isExplainPending}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-teal-500 px-5 text-sm font-black text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-teal-300"
          >
            {isExplainPending ? <LoaderCircle size={18} className="animate-spin" /> : <WandSparkles size={18} />}
            {isExplainPending ? "后台解释中..." : "解释公式"}
          </button>
          {isExplainPending ? (
            <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold leading-6 text-sky-800">
              公式解释已在后台运行，切换页面不会中断，完成后会弹出通知。
            </div>
          ) : null}
          {result ? (
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
              {typeof result.pointsCost === "number" ? <span className="rounded-full bg-slate-100 px-3 py-1.5">消耗 {result.pointsCost} 积分</span> : null}
              {typeof result.currentPoints === "number" ? <span className="rounded-full bg-slate-100 px-3 py-1.5">当前 {result.currentPoints} 积分</span> : null}
              {typeof result.cacheHit === "boolean" ? (
                <span className={`rounded-full px-3 py-1.5 ${result.cacheHit ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"}`}>
                  {result.cacheHit ? "缓存命中" : "实时生成"}
                </span>
              ) : null}
            </div>
          ) : null}
        </LitePanel>

        {result ? (
          <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto pr-1">
            <FormulaExplainResult result={result} />
          </div>
        ) : (
          <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto pr-1">
            <LitePanel>
              <h2 className="mb-4 text-base font-black text-slate-900">公式解释</h2>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="overflow-auto rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-xs leading-6 text-slate-800 sm:text-sm">
                  <div className="grid min-w-max grid-cols-[minmax(18rem,1fr)_auto] gap-4">
                    <code>LET(</code>
                  </div>
                  <div className="grid min-w-max grid-cols-[minmax(18rem,1fr)_auto] gap-4">
                    <code className="whitespace-pre">  <span className="rounded bg-amber-100 px-1 font-black text-amber-800 ring-1 ring-amber-200">data</span>,</code>
                    <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-700">定义 LET 参数 data</span>
                  </div>
                  <div className="grid min-w-max grid-cols-[minmax(18rem,1fr)_auto] gap-4">
                    <code className="whitespace-pre">  A2:A100,</code>
                  </div>
                  <div className="grid min-w-max grid-cols-[minmax(18rem,1fr)_auto] gap-4">
                    <code className="whitespace-pre">  FILTER(</code>
                  </div>
                  <div className="grid min-w-max grid-cols-[minmax(18rem,1fr)_auto] gap-4">
                    <code className="whitespace-pre">    <span className="rounded bg-teal-50 px-1 font-black text-teal-700 ring-1 ring-teal-100">data</span>,</code>
                    <span className="rounded-full border border-teal-100 bg-teal-50 px-2 py-0.5 text-[11px] font-black text-teal-700">引用 LET 参数 data</span>
                  </div>
                  <div className="grid min-w-max grid-cols-[minmax(18rem,1fr)_auto] gap-4">
                    <code className="whitespace-pre">    <span className="rounded bg-teal-50 px-1 font-black text-teal-700 ring-1 ring-teal-100">data</span>&lt;&gt;&quot;&quot;</code>
                    <span className="rounded-full border border-teal-100 bg-teal-50 px-2 py-0.5 text-[11px] font-black text-teal-700">引用 LET 参数 data</span>
                  </div>
                  <div className="grid min-w-max grid-cols-[minmax(18rem,1fr)_auto] gap-4">
                    <code className="whitespace-pre">  )</code>
                  </div>
                  <div className="grid min-w-max grid-cols-[minmax(18rem,1fr)_auto] gap-4">
                    <code>)</code>
                  </div>
                </div>
              </div>
            </LitePanel>
          </div>
        )}
      </section>
    </LitePageFrame>
  );
}
