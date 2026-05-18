import { RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { router } from "./routes";
import { Toaster } from "sonner";
import { SessionProvider, useSession } from "./lib/session";
import { queryClient } from "./lib/query-client";
import { GlobalFeedbackDialog } from "./components/GlobalFeedbackDialog";
import { GlobalConfirmPromptDialog } from "./components/GlobalConfirmPromptDialog";
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeBridge />
        <Toaster position="top-center" />
        <GlobalFeedbackDialog />
        <GlobalConfirmPromptDialog />
        <RouterProvider router={router} />
      </SessionProvider>
    </QueryClientProvider>
  );
}
