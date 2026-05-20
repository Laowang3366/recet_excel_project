import { toast } from "sonner";
import { isLoginRequiredError } from "./auth-errors";
import { buildCurrentAuthRedirectPath } from "./auth-redirect";

export function showLoginRequiredToast(message = "请先登录后继续操作") {
  toast.info(message, {
    action: {
      label: "去登录",
      onClick: () => {
        window.location.assign(buildCurrentAuthRedirectPath());
      },
    },
  });
}

export function handleLoginRequiredError(error: unknown, message?: string) {
  if (!isLoginRequiredError(error)) return false;
  showLoginRequiredToast(message);
  return true;
}
