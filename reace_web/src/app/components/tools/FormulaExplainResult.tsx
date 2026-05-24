import type { ReactNode } from "react";
import { AlertTriangle, Code2, Copy, Cpu, FunctionSquare, Lightbulb, ListTree, Wrench } from "lucide-react";
import { toast } from "sonner";
import { LitePanel, LiteSectionTitle } from "../LiteSurface";
import {
  buildFormulaLayout,
  formatFormulaAnalysis,
  formatFormulaExplanationForCopy,
  type FormulaCallEdge,
  type FormulaExplainResponse,
} from "../../lib/formula-explainer";

type FormulaExplainResultProps = {
  result: FormulaExplainResponse;
};

export function FormulaExplainResult({ result }: FormulaExplainResultProps) {
  const analysisText = formatFormulaAnalysis(result.analysis);
  const formulaLayout = buildFormulaLayout(result.formula || result.normalizedFormula);
  const annotatedLines = buildAnnotatedFormulaLines(formulaLayout.formattedLines, formulaLayout.callEdges);
  const copyResult = async () => {
    await navigator.clipboard.writeText(formatFormulaExplanationForCopy(result));
    toast.success("解释结果已复制");
  };

  return (
    <LitePanel>
      <LiteSectionTitle
        eyebrow="解释结果"
        title="公式优化排版"
        description="函数高亮、参数层级、行内注释和风险信号。"
        action={
          <button
            type="button"
            onClick={copyResult}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-800"
          >
            <Copy size={16} />
            复制
          </button>
        }
      />

      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm leading-7 text-emerald-950">
        {result.summary}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
        {result.model ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5">
            <Cpu size={13} />
            {result.model}
          </span>
        ) : null}
        {typeof result.cacheHit === "boolean" ? (
          <span className={`rounded-full px-3 py-1.5 ${result.cacheHit ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"}`}>
            {result.cacheHit ? "缓存命中" : "实时生成"}
          </span>
        ) : null}
        {typeof result.pointsCost === "number" ? <span className="rounded-full bg-slate-100 px-3 py-1.5">消耗 {result.pointsCost} 积分</span> : null}
        {typeof result.currentPoints === "number" ? <span className="rounded-full bg-slate-100 px-3 py-1.5">当前 {result.currentPoints} 积分</span> : null}
        {result.fallbackUsed ? <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">备用模型</span> : null}
      </div>

      {analysisText ? (
        <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
          <SectionTitle icon={<ListTree size={18} />} title="公式分析" />
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-sky-950">{analysisText}</p>
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionTitle icon={<Code2 size={18} />} title="公式优化排版" />
          {formulaLayout.signals.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {formulaLayout.signals.map((signal) => (
                <span key={signal} className="rounded-full border border-teal-100 bg-white px-2.5 py-1 text-xs font-bold text-teal-700">
                  {signal}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-3 max-h-[26rem] overflow-auto rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-xs leading-6 text-slate-800 sm:text-sm">
          {annotatedLines.map((line, index) => (
            <div key={`${line.raw}-${index}`} className="grid min-w-max grid-cols-[minmax(18rem,1fr)_auto] items-start gap-4">
              <code className="whitespace-pre">
                {line.functionName ? (
                  <>
                    {line.indent}
                    <span className="rounded bg-teal-50 px-1 font-black text-teal-700">{line.functionName}</span>
                    {line.suffix}
                  </>
                ) : (
                  line.raw
                )}
              </code>
              {line.annotation ? (
                <span className="mt-0.5 rounded-full border border-teal-100 bg-teal-50 px-2 py-0.5 text-[11px] font-black leading-5 text-teal-700">
                  {line.annotation}
                </span>
              ) : null}
            </div>
          ))}
        </div>

        {formulaLayout.blocks.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {formulaLayout.blocks.map((block) => (
              <span key={block.id} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
                <span className="font-black text-slate-900">{block.name}</span>
                <span>深度 {block.depth}</span>
                {block.children.length > 0 ? <span className="text-teal-700">调用 {block.children.join("、")}</span> : null}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-6 space-y-4">
        <SectionTitle icon={<ListTree size={18} />} title="分段说明" />
        {result.segments.map((segment, index) => (
          <div key={`${segment.text}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-sm font-black text-slate-900">{index + 1}. {segment.title}</div>
            <code className="mt-3 block break-all rounded-xl bg-white px-3 py-2 text-sm font-semibold text-teal-700">
              {segment.text}
            </code>
            <p className="mt-3 text-sm leading-7 text-slate-600">{segment.explanation}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 px-4 py-4">
          <SectionTitle icon={<FunctionSquare size={18} />} title="函数说明" />
          <div className="mt-3 space-y-2">
            {result.functions.map((item) => (
              <div key={item.name} className="text-sm leading-6 text-slate-600">
                <span className="font-black text-slate-900">{item.name}</span>：{item.purpose}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 px-4 py-4">
          <SectionTitle icon={<AlertTriangle size={18} />} title="注意事项" />
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            {result.warnings.map((item) => <li key={item}>- {item}</li>)}
            {result.warnings.length === 0 ? <li>未发现明显风险。</li> : null}
          </ul>
        </div>
      </div>

      {result.suggestions.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
          <SectionTitle icon={<Lightbulb size={18} />} title="优化建议" />
          <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900">
            {result.suggestions.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </div>
      ) : null}

      {result.fixes && result.fixes.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-4">
          <SectionTitle icon={<Wrench size={18} />} title="修复建议" />
          <ul className="mt-3 space-y-2 text-sm leading-6 text-teal-950">
            {result.fixes.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </div>
      ) : null}
    </LitePanel>
  );
}

type AnnotatedFormulaLine = {
  raw: string;
  indent: string;
  functionName?: string;
  suffix?: string;
  annotation?: string;
};

function buildAnnotatedFormulaLines(formattedLines: string, callEdges: FormulaCallEdge[]): AnnotatedFormulaLine[] {
  const pendingEdges = [...callEdges];
  return formattedLines.split("\n").map((raw) => {
    const match = raw.match(/^(\s*)([A-Z_][A-Z0-9_.]*)(\()$/);
    if (!match) {
      return { raw, indent: "" };
    }

    const functionName = match[2];
    const edgeIndex = pendingEdges.findIndex((edge) => edge.to === functionName);
    const edge = edgeIndex >= 0 ? pendingEdges.splice(edgeIndex, 1)[0] : null;
    return {
      raw,
      indent: match[1],
      functionName,
      suffix: match[3],
      annotation: edge ? `${edge.from} 参数 ${edge.argumentIndex} 调用 ${edge.to}` : undefined,
    };
  });
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-black text-slate-900">
      <span className="text-teal-600">{icon}</span>
      {title}
    </div>
  );
}
