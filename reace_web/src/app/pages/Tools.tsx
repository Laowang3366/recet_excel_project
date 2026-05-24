import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Braces, Clock3, FileUp, LoaderCircle, Sparkles, Trash2, WandSparkles } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { FormulaExplainResult } from "../components/tools/FormulaExplainResult";
import { LiteHero, LitePageFrame, LitePanel, LiteSectionTitle } from "../components/LiteSurface";
import { api, ApiError } from "../lib/api";
import { buildCurrentAuthRedirectPath } from "../lib/auth-redirect";
import {
  validateFormulaInput,
  type FormulaExplainRequest,
  type FormulaExplainResponse,
} from "../lib/formula-explainer";
import { toolsKeys } from "../lib/query-keys";
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
  const [formula, setFormula] = useState(exampleFormulas[0].formula);
  const [workbookContext, setWorkbookContext] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [errorMessageInput, setErrorMessageInput] = useState("");
  const [result, setResult] = useState<FormulaExplainResponse | null>(null);

  const explainMutation = useMutation({
    mutationKey: toolsKeys.formulaExplain(),
    mutationFn: async () => {
      const validation = validateFormulaInput(formula, {
        workbookContext,
        expectedResult,
        errorMessageInput,
      });
      if (!validation.ok) {
        throw new Error(validation.message);
      }
      const payload: FormulaExplainRequest = {
        formula,
        locale: "zh-CN",
        detailLevel: "standard",
        workbookContext: workbookContext.trim() || undefined,
        expectedResult: expectedResult.trim() || undefined,
        errorMessageInput: errorMessageInput.trim() || undefined,
      };
      return api.post<FormulaExplainResponse>("/api/tools/formula/explain", payload, { silent: true });
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success("公式解释已生成");
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        navigate(buildCurrentAuthRedirectPath());
        return;
      }
      if (error instanceof ApiError && error.status === 402) {
        toast.info(error.message || "积分不足，请获取积分后再使用公式解释器");
        return;
      }
      if (error instanceof ApiError && error.status === 400) {
        toast.info(error.message || "公式或上下文格式不正确，请检查后重试");
        return;
      }
      toast.error(error instanceof Error ? error.message : "公式解释失败，请稍后重试");
    },
  });

  const handleExplain = () => {
    if (!isAuthenticated) {
      navigate(buildCurrentAuthRedirectPath());
      return;
    }
    void explainMutation.mutateAsync();
  };

  const applyExample = (value: string) => {
    setFormula(value);
    setResult(null);
  };

  return (
    <LitePageFrame>
      <LiteHero
        eyebrow="实用工具"
        title="函数公式解释器"
        description="粘贴 Excel 公式后生成中文解释、分段说明、函数含义、注意事项和优化建议。"
        actions={
          <>
            <button
              type="button"
              onClick={handleExplain}
              disabled={explainMutation.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-slate-900 disabled:cursor-not-allowed disabled:bg-white/60"
            >
              {explainMutation.isPending ? <LoaderCircle size={16} className="animate-spin" /> : <WandSparkles size={16} />}
              {explainMutation.isPending ? "正在解释..." : "解释公式"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/tools/convert")}
              className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-6 py-3 text-sm font-bold text-white"
            >
              <FileUp size={16} />
              文件转换
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
                setWorkbookContext("");
                setExpectedResult("");
                setErrorMessageInput("");
                setResult(null);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-6 py-3 text-sm font-bold text-white"
            >
              <Trash2 size={16} />
              清空
            </button>
          </>
        }
        aside={
          <div className="rounded-[30px] border border-white/12 bg-white/10 p-5 backdrop-blur-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[12px] font-black tracking-[0.18em] text-white/70">FORMULA</div>
                <div className="mt-2 text-2xl font-black text-white">结构化解释</div>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <Sparkles size={22} />
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {[
                "支持任意合法 Excel 公式",
                "单条公式最多 2000 个字符",
                "可附带表格上下文、期望结果和报错信息",
                isAuthenticated ? "AI 解释消耗 1 积分，缓存命中不扣积分" : "登录后可使用解释器",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white/82">
                  {item}
                </div>
              ))}
            </div>
          </div>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <LitePanel>
          <LiteSectionTitle
            eyebrow="输入公式"
            title="粘贴需要解释的公式"
            description="可以保留开头等号，也可以只输入函数主体。"
          />
          <textarea
            value={formula}
            onChange={(event) => {
              setFormula(event.target.value);
              setResult(null);
            }}
            spellCheck={false}
            className="mt-6 min-h-[220px] w-full resize-y rounded-[26px] border border-slate-200 bg-slate-50 px-5 py-4 font-mono text-sm leading-7 text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-100"
            placeholder="=IFERROR(XLOOKUP(A2,客户表[手机号],客户表[姓名]),&quot;未找到&quot;)"
          />
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <label className="block">
              <span className="text-sm font-black text-slate-700">表格上下文</span>
              <textarea
                value={workbookContext}
                onChange={(event) => setWorkbookContext(event.target.value)}
                spellCheck={false}
                className="mt-2 min-h-[120px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-100"
                placeholder="例如：A列为客户手机号，B列为客户姓名，F2 是待查询手机号"
              />
            </label>
            <label className="block">
              <span className="text-sm font-black text-slate-700">期望结果</span>
              <textarea
                value={expectedResult}
                onChange={(event) => setExpectedResult(event.target.value)}
                spellCheck={false}
                className="mt-2 min-h-[120px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-100"
                placeholder="例如：查询到手机号对应的客户姓名，找不到时显示未找到"
              />
            </label>
            <label className="block">
              <span className="text-sm font-black text-slate-700">错误信息</span>
              <textarea
                value={errorMessageInput}
                onChange={(event) => setErrorMessageInput(event.target.value)}
                spellCheck={false}
                className="mt-2 min-h-[120px] w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-100"
                placeholder="例如：#N/A、#VALUE! 或公式当前返回的异常结果"
              />
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {exampleFormulas.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => applyExample(item.formula)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
              >
                {item.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleExplain}
            disabled={explainMutation.isPending}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-teal-500 px-5 text-sm font-black text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-teal-300"
          >
            {explainMutation.isPending ? <LoaderCircle size={18} className="animate-spin" /> : <WandSparkles size={18} />}
            {explainMutation.isPending ? "正在解释..." : "解释公式"}
          </button>
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

        <LitePanel>
          <LiteSectionTitle
            eyebrow="输出结构"
            title="公式优化排版"
            description="结果会按整体用途、公式片段、函数含义、风险点和优化建议展示。"
          />
          <div className="mt-6 space-y-3">
            {[
              ["整体解释", "先说明公式解决的问题。"],
              ["分段说明", "按嵌套函数和关键参数拆开。"],
              ["函数说明", "列出识别到的函数和用途。"],
              ["注意事项", "指出匹配失败、区域不一致等风险。"],
            ].map(([title, text]) => (
              <div key={title} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-teal-600">
                  <Braces size={18} />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900">{title}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-500">{text}</div>
                </div>
              </div>
            ))}
          </div>
        </LitePanel>
      </section>

      {result ? <FormulaExplainResult result={result} /> : null}
    </LitePageFrame>
  );
}
