export function stockQuotaProgress(rate) {
  const limit = Number(rate?.limit);
  const remaining = Number(rate?.remaining);
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(remaining)) return null;
  const safeRemaining = Math.max(0, Math.min(limit, remaining));
  const used = Math.max(0, limit - safeRemaining);
  const usedPercent = Math.max(0, Math.min(100, (used / limit) * 100));
  const remainingPercent = Math.max(0, 100 - usedPercent);
  return {
    limit,
    remaining: safeRemaining,
    used,
    usedPercent,
    remainingPercent,
    usedPercentRounded: Math.round(usedPercent),
    remainingPercentRounded: Math.round(remainingPercent),
    tone: usedPercent >= 85 ? "critical" : usedPercent >= 60 ? "warning" : "healthy",
  };
}
