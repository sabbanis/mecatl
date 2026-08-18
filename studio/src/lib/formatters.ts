export function formatRelativeTime(ts: number): string {
  if (!ts || ts < 1000) return "";
  try {
    const diffMs = Date.now() - ts;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "<1m";
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d`;
  } catch {
    return "";
  }
}

export function formatCost(cost: number | null): string {
  if (cost == null) return "$0.00";
  return `$${cost.toFixed(2)}`;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

const CRON_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatClock(hour: number, minute: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${period}`;
}

/**
 * Render a standard 5-field cron expression in plain English for the common
 * shapes our scheduled tasks use (daily/weekly at a time, every N hours or
 * minutes). Anything it doesn't recognise falls back to the raw expression, so
 * the exact cron is still available (shown in a tooltip alongside).
 */
export function describeCron(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, dom, mon, dow] = parts;
  const everyHour = /^\*\/(\d+)$/.exec(hour);
  const everyMin = /^\*\/(\d+)$/.exec(min);
  const numMin = /^\d+$/.test(min);
  const numHour = /^\d+$/.test(hour);

  if (everyMin && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    return `Every ${everyMin[1]} minutes`;
  }
  if (everyHour && numMin && dom === "*" && mon === "*" && dow === "*") {
    return `Every ${everyHour[1]} hours`;
  }
  if (numMin && numHour && dom === "*" && mon === "*") {
    const time = formatClock(Number(hour), Number(min));
    if (dow === "*") return `Daily at ${time}`;
    if (/^\d$/.test(dow))
      return `Weekly on ${CRON_DAYS[Number(dow)]} at ${time}`;
  }
  return expr;
}

export function formatMessageTime(ts: number): string {
  if (!ts || ts < 1000) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
