import { describe, expect, it } from "vitest";

import {
  notificationConfirmDialogContentClassName,
  notificationFormDialogBodyClassName,
  notificationFormDialogContentClassName,
  notificationFormDialogFooterClassName,
} from "./notification-dialog-layout";

describe("notification dialog layout classes", () => {
  it("keeps the new notification dialog stacked and full width", () => {
    expect(notificationFormDialogContentClassName).toContain("!flex");
    expect(notificationFormDialogContentClassName).toContain("!flex-col");
    expect(notificationFormDialogContentClassName).toContain("w-[min(1180px,calc(100vw-2rem))]");
    expect(notificationFormDialogBodyClassName).toContain("lg:grid-cols-[minmax(0,1fr)_440px]");
  });

  it("keeps dialog footers inside the modal bottom edge", () => {
    expect(notificationFormDialogFooterClassName).toContain("justify-end");
    expect(notificationConfirmDialogContentClassName).toContain("w-[min(560px,calc(100vw-2rem))]");
  });
});
