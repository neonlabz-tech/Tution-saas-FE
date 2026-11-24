import { request } from "@/lib/api";
import type {
  AnalyticsOverviewResponse,
  AnalyticsPeriodParams,
  ModulePerformanceResponse,
} from "@/types";

export function buildAnalyticsQuery(
  params: AnalyticsPeriodParams,
): string {
  const qs = new URLSearchParams();
  qs.set("period", params.period);

  if (params.period === "custom") {
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
  }

  if (params.batch && params.batch !== "all") {
    qs.set("batch", params.batch);
  }
  if (params.moduleId && params.moduleId !== "all") {
    qs.set("moduleId", params.moduleId);
  }
  if (params.status && params.status !== "all") {
    qs.set("status", params.status);
  }

  const str = qs.toString();
  return str ? `?${str}` : "";
}

export const analyticsApi = {
  getOverview(
    params: AnalyticsPeriodParams,
    signal?: AbortSignal,
  ): Promise<AnalyticsOverviewResponse> {
    const qs = buildAnalyticsQuery(params);
    return request<AnalyticsOverviewResponse>(`/analytics/overview${qs}`, { signal });
  },

  getModulePerformance(
    params: AnalyticsPeriodParams,
    signal?: AbortSignal,
  ): Promise<ModulePerformanceResponse> {
    const qs = buildAnalyticsQuery(params);
    return request<ModulePerformanceResponse>(`/analytics/modules${qs}`, { signal });
  },

  // Aliases
  overview(params: AnalyticsPeriodParams, signal?: AbortSignal) {
    return this.getOverview(params, signal);
  },
  modules(params: AnalyticsPeriodParams, signal?: AbortSignal) {
    return this.getModulePerformance(params, signal);
  },
};
