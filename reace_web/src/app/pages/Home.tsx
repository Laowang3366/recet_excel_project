import { ArrowRight, BookOpen, FileText, Layers3, Sparkles, Target, Wrench } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { LitePageFrame } from "../components/LiteSurface";

export function Home() {
  const navigate = useNavigate();

  const featureCards = [
    {
      title: "教程中心",
      text: "按函数场景组织知识点，直接关联章节和练习题。",
      icon: <BookOpen size={24} />,
      action: () => navigate("/tutorials"),
    },
    {
      title: "章节闯关",
      text: "用关卡地图推进学习路径，记录星级、错题和排行。",
      icon: <Target size={24} />,
      action: () => navigate("/practice"),
    },
    {
      title: "模板中心",
      text: "按行业下载可复用的 Excel 模板，积分体系自动结算。",
      icon: <Layers3 size={24} />,
      action: () => navigate("/templates"),
    },
    {
      title: "实用工具",
      text: "公式解释、历史记录和效率工具集中处理。",
      icon: <Wrench size={24} />,
      action: () => navigate("/tools"),
    },
  ];

  return (
    <LitePageFrame className="max-w-none px-0 py-0">
      <section className="relative isolate min-h-[640px] overflow-hidden bg-[#00140d] px-5 pb-8 pt-20 text-white sm:min-h-[700px] sm:px-8 sm:pt-24 lg:min-h-[760px] lg:pt-28">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(118deg,rgba(0,176,80,0.52)_0%,rgba(34,197,94,0.22)_28%,transparent_50%),radial-gradient(circle_at_78%_18%,rgba(124,255,178,0.18),transparent_34%),linear-gradient(180deg,#00140d_0%,#001b12_100%)]" />
        <div className="absolute inset-0 -z-10 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:100%_8px]" />
        <div className="absolute left-[8%] top-8 -z-10 h-[420px] w-[420px] rounded-full bg-[#00b050]/24 blur-[110px]" />
        <div className="absolute right-[8%] top-24 -z-10 h-[360px] w-[360px] rounded-full bg-[#7cffb2]/14 blur-[120px]" />

        <div className="mx-auto flex min-h-[430px] max-w-[1320px] flex-col items-center justify-center text-center sm:min-h-[500px] lg:min-h-[560px]">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/8 px-5 py-2 text-sm text-white/82 backdrop-blur"
          >
            <Sparkles size={16} className="text-white" />
            Excel 学习平台
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            className="mt-8 max-w-[1120px] text-[44px] font-black leading-[0.98] tracking-tight text-white sm:text-[76px] lg:text-[92px]"
          >
            Excel学习平台 - 从函数到实战
          </motion.h1>
          <p className="mt-6 max-w-3xl text-lg font-semibold leading-8 text-white/58 sm:text-2xl">
            学函数、做练习、查模板、用工具，围绕 Excel 日常工作形成完整学习路径。
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={() => navigate("/practice")}
              className="group inline-flex h-[60px] items-center gap-5 rounded-full bg-white pl-7 pr-2 text-2xl font-black text-[#00a651] shadow-[0_18px_44px_rgba(255,255,255,0.14)] transition hover:bg-[#00b050] hover:text-white"
            >
              立即练习
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#00b050] text-white transition group-hover:bg-white group-hover:text-[#00a651]">
                <ArrowRight size={20} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/tutorials")}
              className="inline-flex h-[60px] items-center rounded-full border border-white/20 bg-white/8 px-7 text-lg font-bold text-white/86 backdrop-blur transition hover:bg-white/14"
            >
              进入教程中心
            </button>
          </div>
        </div>

        <div className="mx-auto grid max-w-[1320px] gap-4 lg:grid-cols-4">
          {featureCards.map((card, index) => (
            <motion.button
              key={card.title}
              type="button"
              onClick={card.action}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + index * 0.04 }}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b1f17]/90 p-6 text-left transition hover:-translate-y-1 hover:border-[#00b050]/75"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-[#9cffc3] shadow-[0_0_24px_rgba(0,176,80,0.45)]">
                {card.icon}
              </div>
              <div className="mt-5 text-lg font-black text-white">{card.title}</div>
              <p className="mt-3 text-sm leading-6 text-white/56">{card.text}</p>
            </motion.button>
          ))}
        </div>
      </section>

      <section className="bg-[#00140d] px-5 py-24 text-white sm:px-8">
        <div className="mx-auto grid max-w-[1320px] gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/8 px-4 py-2 text-sm font-bold text-[#9cffc3]">
              <FileText size={16} />
              教程中心
            </div>
            <h2 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">
              函数教程、分类搜索与关联练习。
            </h2>
            <p className="mt-5 text-xl leading-8 text-white/56">
              按函数类型查看教程，阅读用法、语法和示例后，可进入对应章节继续练习。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/tutorials")}
                className="inline-flex items-center gap-2 rounded-full bg-[#00b050] px-6 py-3 text-sm font-black text-white transition hover:bg-[#008f43]"
              >
                浏览教程中心
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => navigate("/practice")}
                className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/8 px-6 py-3 text-sm font-black text-white/82 transition hover:bg-white/14"
              >
                查看题型章节
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["函数分类", "函数基础、逻辑判断、查找引用、文本处理等分类清晰归档。"],
              ["关键词检索", "可按函数名、教程主题或业务场景快速查找。"],
              ["关联练习", "教程可进入关联章节和题目，把阅读转为实操。"],
              ["错题复盘", "练习后的薄弱题目进入错题复习，便于反复巩固。"],
            ].map(([title, text]) => (
              <div key={title} className="rounded-[28px] border border-white/10 bg-white/8 px-6 py-7">
                <div className="text-lg font-black text-white">{title}</div>
                <p className="mt-3 text-sm leading-6 text-white/52">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-[1320px]">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">始终围绕实战准备</h2>
            <p className="mt-5 text-xl leading-8 text-slate-600">
              把教程、练习、模板和工具串成可复用的学习工作流。
            </p>
          </div>
          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {[
              ["学完即练", "每篇教程都优先连接到章节或题目，减少从阅读到实操的断点。"],
              ["错题循环", "练习结果进入错题复盘，帮助你把薄弱函数真正练熟。"],
              ["模板沉淀", "高频业务场景沉淀为模板，学习成果可以直接进入工作。"],
            ].map(([title, text]) => (
              <div key={title} className="rounded-[28px] bg-[#eafff2] px-8 py-10">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00b050] text-white shadow-[0_18px_38px_rgba(0,176,80,0.24)]">
                  <Sparkles size={26} />
                </div>
                <h3 className="mt-9 text-2xl font-black text-slate-950">{title}</h3>
                <p className="mt-3 text-base leading-7 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </LitePageFrame>
  );
}
