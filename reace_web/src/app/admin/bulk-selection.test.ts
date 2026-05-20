import { describe, expect, it } from "vitest";
import {
  pruneAdminBulkSelection,
  runSequentialAdminBulkAction,
  toggleAdminBulkId,
  toggleAdminBulkPageSelection,
} from "./bulk-selection";

describe("admin bulk selection helpers", () => {
  it("toggles one item without mutating the previous selection", () => {
    const selected = new Set<number>([1]);
    const next = toggleAdminBulkId(selected, 2);

    expect(Array.from(selected)).toEqual([1]);
    expect(Array.from(next).sort()).toEqual([1, 2]);
    expect(Array.from(toggleAdminBulkId(next, 1))).toEqual([2]);
  });

  it("selects and clears all visible rows on the current page", () => {
    const selected = new Set<number>([9]);
    const visibleIds = [1, 2, 3];
    const allSelected = toggleAdminBulkPageSelection(selected, visibleIds);

    expect(Array.from(allSelected).sort()).toEqual([1, 2, 3, 9]);
    expect(Array.from(toggleAdminBulkPageSelection(allSelected, visibleIds))).toEqual([9]);
  });

  it("removes selections that no longer exist in the visible data set", () => {
    expect(Array.from(pruneAdminBulkSelection(new Set([1, 2, 3]), [2, 3, 4]))).toEqual([2, 3]);
  });

  it("runs destructive bulk actions sequentially", async () => {
    const order: number[] = [];

    const result = await runSequentialAdminBulkAction([1, 2, 3], async (id) => {
      order.push(id);
    });

    expect(order).toEqual([1, 2, 3]);
    expect(result).toEqual({ successCount: 3, failedCount: 0, firstError: null });
  });
});
