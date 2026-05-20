import { useCallback, useEffect, useMemo, useState } from "react";

export type AdminBulkId = number | string;

export function toggleAdminBulkId<T extends AdminBulkId>(selectedIds: ReadonlySet<T>, id: T) {
  const next = new Set(selectedIds);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

export function toggleAdminBulkPageSelection<T extends AdminBulkId>(
  selectedIds: ReadonlySet<T>,
  visibleIds: readonly T[],
) {
  const next = new Set(selectedIds);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id));
  visibleIds.forEach((id) => {
    if (allVisibleSelected) {
      next.delete(id);
    } else {
      next.add(id);
    }
  });
  return next;
}

export function pruneAdminBulkSelection<T extends AdminBulkId>(
  selectedIds: ReadonlySet<T>,
  visibleIds: readonly T[],
) {
  const visible = new Set(visibleIds);
  return new Set(Array.from(selectedIds).filter((id) => visible.has(id)));
}

function hasSameAdminBulkIds<T extends AdminBulkId>(left: ReadonlySet<T>, right: ReadonlySet<T>) {
  if (left.size !== right.size) return false;
  return Array.from(left).every((id) => right.has(id));
}

export async function runSequentialAdminBulkAction<T>(
  items: readonly T[],
  action: (item: T) => Promise<unknown>,
) {
  let successCount = 0;
  let failedCount = 0;
  let firstError: unknown = null;

  // Keep destructive requests sequential so large selections do not burst the admin API.
  for (const item of items) {
    try {
      await action(item);
      successCount += 1;
    } catch (error) {
      failedCount += 1;
      firstError ??= error;
    }
  }

  return { successCount, failedCount, firstError };
}

export function useAdminBulkSelection<T, Id extends AdminBulkId>(
  items: readonly T[],
  getId: (item: T) => Id,
) {
  const [selectedIds, setSelectedIds] = useState<Set<Id>>(() => new Set());
  const visibleIds = useMemo(() => items.map(getId), [items]);

  useEffect(() => {
    setSelectedIds((current) => {
      const next = pruneAdminBulkSelection(current, visibleIds);
      return hasSameAdminBulkIds(current, next) ? current : next;
    });
  }, [visibleIds]);

  const selectedItems = useMemo(() => {
    const selected = selectedIds;
    return items.filter((item) => selected.has(getId(item)));
  }, [items, selectedIds]);

  const selectedCount = selectedIds.size;
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const isSelected = useCallback((id: Id) => selectedIds.has(id), [selectedIds]);
  const toggleOne = useCallback((id: Id) => setSelectedIds((current) => toggleAdminBulkId(current, id)), []);
  const toggleAllVisible = useCallback(
    () => setSelectedIds((current) => toggleAdminBulkPageSelection(current, visibleIds)),
    [visibleIds],
  );
  const clear = useCallback(() => setSelectedIds(new Set()), []);

  return {
    selectedIds,
    selectedItems,
    selectedCount,
    allVisibleSelected,
    isSelected,
    toggleOne,
    toggleAllVisible,
    clear,
  };
}
