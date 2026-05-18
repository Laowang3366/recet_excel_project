import type { ComponentType } from "react";
import { createBrowserRouter, Navigate, useParams, useSearchParams } from "react-router";
import { Layout } from "./components/Layout";
import { getCampaignQuestionListPath } from "./lib/practice-campaign-ui";

type LazyRouteModule = Record<string, unknown>;

function lazyPage(importer: () => Promise<LazyRouteModule>, exportName: string) {
  return async () => {
    const module = await importer();
    return { Component: module[exportName] as ComponentType };
  };
}

function AdminRedirect() {
  return <Navigate to="/admin/overview" replace />;
}

function PracticeChapterRedirect() {
  const { id } = useParams();
  return <Navigate to={getCampaignQuestionListPath(id)} replace />;
}

function PracticeChaptersRedirect() {
  const [searchParams] = useSearchParams();
  return <Navigate to={getCampaignQuestionListPath(searchParams.get("chapter"))} replace />;
}

function pageRoute(path: string, importer: () => Promise<LazyRouteModule>, exportName: string) {
  return { path, lazy: lazyPage(importer, exportName) };
}

export const router = createBrowserRouter([
  { path: "/auth", lazy: lazyPage(() => import("./pages/Auth"), "Auth") },
  {
    path: "/admin",
    lazy: lazyPage(() => import("./pages/AdminLayout"), "AdminLayout"),
    children: [
      { index: true, lazy: lazyPage(() => import("./pages/AdminLayout"), "AdminIndex") },
      { path: "overview", lazy: lazyPage(() => import("./pages/AdminOverview"), "AdminOverview") },
      { path: "home-content", lazy: lazyPage(() => import("./pages/AdminHomeContent"), "AdminHomeContent") },
      { path: "users", lazy: lazyPage(() => import("./pages/AdminUsers"), "AdminUsers") },
      { path: "notifications", lazy: lazyPage(() => import("./pages/AdminNotifications"), "AdminNotifications") },
      { path: "questions", lazy: lazyPage(() => import("./pages/AdminQuestions"), "AdminQuestions") },
      { path: "question-categories", lazy: lazyPage(() => import("./pages/AdminQuestionCategories"), "AdminQuestionCategories") },
      { path: "templates", lazy: lazyPage(() => import("./pages/AdminTemplateCenter"), "AdminTemplateCenter") },
      { path: "points", lazy: lazyPage(() => import("./pages/AdminPoints"), "AdminPoints") },
      { path: "levels", lazy: lazyPage(() => import("./pages/AdminLevels"), "AdminLevels") },
      { path: "assistant", lazy: lazyPage(() => import("./pages/AdminAssistant"), "AdminAssistant") },
      { path: "*", Component: AdminRedirect },
    ],
  },
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, lazy: lazyPage(() => import("./pages/Home"), "Home") },
      pageRoute("practice", () => import("./pages/PracticeCampaignHub"), "PracticeCampaignHub"),
      { path: "practice/chapters", Component: PracticeChaptersRedirect },
      pageRoute("practice/classic", () => import("./pages/Practice"), "Practice"),
      { path: "practice/chapter/:id", Component: PracticeChapterRedirect },
      pageRoute("practice/result/:id", () => import("./pages/PracticeCampaignResult"), "PracticeCampaignResult"),
      pageRoute("practice/daily", () => import("./pages/PracticeCampaignDaily"), "PracticeCampaignDaily"),
      pageRoute("practice/wrongs", () => import("./pages/PracticeCampaignWrongs"), "PracticeCampaignWrongs"),
      pageRoute("practice/ranking", () => import("./pages/PracticeCampaignRanking"), "PracticeCampaignRanking"),
      pageRoute("practice/random", () => import("./pages/PracticeDetail"), "PracticeDetail"),
      pageRoute("practice/question/:id", () => import("./pages/PracticeDetail"), "PracticeDetail"),
      pageRoute("practice/history", () => import("./pages/PracticeHistory"), "PracticeHistory"),
      pageRoute("practice/history/:id", () => import("./pages/PracticeRecordDetail"), "PracticeRecordDetail"),
      pageRoute("templates", () => import("./pages/TemplateCenter"), "TemplateCenter"),
      pageRoute("templates/records", () => import("./pages/TemplatePurchaseRecords"), "TemplatePurchaseRecords"),
      pageRoute("tutorials", () => import("./pages/TutorialCenter"), "TutorialCenter"),
      pageRoute("mall", () => import("./pages/Mall"), "Mall"),
      pageRoute("mall/props", () => import("./pages/MallProps"), "MallProps"),
      pageRoute("mall/redemptions", () => import("./pages/MallRedemptions"), "MallRedemptions"),
      pageRoute("tools", () => import("./pages/Tools"), "Tools"),
      pageRoute("assistant", () => import("./pages/Assistant"), "Assistant"),
      pageRoute("tools/history", () => import("./pages/ToolsHistory"), "ToolsHistory"),
      pageRoute("notifications", () => import("./pages/Notifications"), "Notifications"),
      pageRoute("profile", () => import("./pages/ProfileCenter"), "ProfileCenter"),
      pageRoute("notification/:id", () => import("./pages/NotificationDetail"), "NotificationDetail"),
      pageRoute("settings", () => import("./pages/Settings"), "Settings"),
      pageRoute("points-history", () => import("./pages/PointHistory"), "PointHistory"),
      pageRoute("task-center", () => import("./pages/TaskCenter"), "TaskCenter"),
    ],
  },
]);
