import { useQuery } from "@tanstack/react-query";
import { LitePageFrame, LitePanel, LiteSectionTitle } from "../components/LiteSurface";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { mallKeys } from "../lib/query-keys";

function formatEntitlementStatus(value?: string | null) {
  if (value === "active") return "已生效";
  if (value === "pending") return "待发放";
  if (value === "revoked") return "已撤销";
  if (value === "expired") return "已过期";
  return value || "-";
}

type MallRedemptionRecord = {
  id: number | string;
  itemName?: string | null;
  itemTypeLabel?: string | null;
  itemType?: string | null;
  status?: string | null;
  statusLabel?: string | null;
  price?: number;
  createTime?: string | null;
  entitlementStatus?: string | null;
};

type MallOverviewResponse = {
  recentRedemptions?: MallRedemptionRecord[];
};

export function MallRedemptions() {
  const overviewQuery = useQuery({
    queryKey: mallKeys.overview(),
    queryFn: () => api.get<MallOverviewResponse>("/api/mall/overview", { silent: true }),
  });

  const records = overviewQuery.data?.recentRedemptions || [];

  return (
    <LitePageFrame>
      <LitePanel>
        <LiteSectionTitle
          eyebrow="REDEMPTIONS"
          title="兑换记录"
          description="查看商品兑换状态、时间和权益发放情况。"
        />
        <div className="mt-6 space-y-3">
          {records.length > 0 ? (
            records.map((record) => (
              <div key={record.id} className="rounded-[24px] border border-slate-200 bg-slate-50/90 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-base font-black text-slate-900">{record.itemName}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-400">{record.itemTypeLabel || record.itemType}</div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${
                    record.status === "fulfilled"
                      ? "bg-emerald-50 text-emerald-600"
                      : record.status === "pending"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-rose-50 text-rose-600"
                  }`}>
                    {record.statusLabel || record.status}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white px-3 py-3">
                    <div className="text-[11px] font-bold text-slate-400">价格</div>
                    <div className="mt-2 text-sm font-black text-amber-600">{record.price}</div>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-3">
                    <div className="text-[11px] font-bold text-slate-400">时间</div>
                    <div className="mt-2 text-sm font-black text-slate-800">{formatDateTime(record.createTime)}</div>
                  </div>
                </div>
                {record.entitlementStatus ? (
                  <div className="mt-3 rounded-2xl bg-white px-3 py-3 text-sm text-slate-500">
                    <span className="font-semibold">权益状态：</span>
                    <span className="font-black text-slate-800">{formatEntitlementStatus(record.entitlementStatus)}</span>
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-400">
              还没有兑换记录。
            </div>
          )}
        </div>
      </LitePanel>
    </LitePageFrame>
  );
}
