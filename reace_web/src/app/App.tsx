import { RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { router } from "./routes";
import { Toaster } from "sonner";
import { SessionProvider, useSession } from "./lib/session";
import { queryClient } from "./lib/query-client";
import { GlobalFeedbackDialog } from "./components/GlobalFeedbackDialog";
import { GlobalConfirmPromptDialog } from "./components/GlobalConfirmPromptDialog";
import { FORMULA_EXPLAIN_TASK_OPEN_EVENT, hydrateFormulaExplainTask } from "./lib/formula-explain-task";
import { applyThemePreference } from "./lib/theme";

function ThemeBridge() {
  const { user } = useSession();

  useEffect(() => {
    applyThemePreference(user?.themePreference || "light");
  }, [user?.themePreference]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const syncWithSystem = () => {
      if ((user?.themePreference || "light") === "system") {
        applyThemePreference("system");
      }
    };
    mediaQuery.addEventListener?.("change", syncWithSystem);
    return () => mediaQuery.removeEventListener?.("change", syncWithSystem);
  }, [user?.themePreference]);

  return null;
}

function FormulaExplainTaskNavigationBridge() {
  useEffect(() => {
    void hydrateFormulaExplainTask()?.catch(() => undefined);
    const handleOpenResult = () => {
      void router.navigate("/tools");
    };
    window.addEventListener(FORMULA_EXPLAIN_TASK_OPEN_EVENT, handleOpenResult);
    return () => window.removeEventListener(FORMULA_EXPLAIN_TASK_OPEN_EVENT, handleOpenResult);
  }, []);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeBridge />
        <FormulaExplainTaskNavigationBridge />
        <Toaster position="top-center" />
        <GlobalFeedbackDialog />
        <GlobalConfirmPromptDialog />
        <RouterProvider router={router} />
      </SessionProvider>
    </QueryClientProvider>
  );
}
