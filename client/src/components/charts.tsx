import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, Cell, ReferenceLine } from "recharts";
import { subjectColor, masteryColor, formatDate } from "@/lib/utils";

const axis = { stroke: "#94a3b8", fontSize: 12, tickLine: false, axisLine: false } as const;

type TooltipProps = { active?: boolean; payload?: { name?: string; value?: number | string; color?: string; dataKey?: string | number }[]; label?: string | number };

function ChartTooltip({ active, payload, label, labelFormat, percent = true }: TooltipProps & { labelFormat?: (l: string) => string; percent?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <div className="mb-1 font-semibold text-ink">{labelFormat ? labelFormat(String(label)) : label}</div>}
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="flex-1">{p.name}</span>
          <span className="font-semibold text-ink">{typeof p.value === "number" ? (percent ? `${Math.round(p.value)}%` : p.value) : "—"}</span>
        </div>
      ))}
    </div>
  );
}

/** Mastery over time, one line per subject. */
export function MasteryTimeline({ data, subjects, height = 280 }: { data: Record<string, number | string>[]; subjects: { slug: string; name: string; color: string }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="date" {...axis} tickFormatter={(d: string) => formatDate(d, { day: "numeric", month: "short" })} minTickGap={24} />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} {...axis} tickFormatter={(v: number) => `${v}%`} />
        <ReferenceLine y={75} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.5} />
        <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.5} />
        <Tooltip content={<ChartTooltip labelFormat={(d) => formatDate(d)} />} cursor={{ stroke: "#c7d2fe", strokeWidth: 1 }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        {subjects.map((s) => (
          <Line key={s.slug} type="monotone" dataKey={s.slug} name={s.name} stroke={subjectColor(s.color).hex} strokeWidth={2} dot={{ r: 3, strokeWidth: 0 }} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars, each coloured by its mastery band (the band is also labelled in the tooltip/text nearby). */
export function MasteryBars({ data, height }: { data: { name: string; value: number | null }[]; height?: number }) {
  const rows = data.filter((d) => d.value !== null) as { name: string; value: number }[];
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(160, rows.length * 34 + 30)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barCategoryGap={8}>
        <CartesianGrid stroke="#eef2f7" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} {...axis} tickFormatter={(v: number) => `${v}%`} />
        <YAxis type="category" dataKey="name" width={130} {...axis} tick={{ fill: "#475569", fontSize: 12 }} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="value" name="Class average" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {rows.map((r) => (
            <Cell key={r.name} fill={masteryColor(r.value)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Two-series grouped bars comparing earlier vs current performance. */
export function ThenNowBars({ data, height = 260 }: { data: { name: string; then: number | null; now: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2} barCategoryGap="22%">
        <CartesianGrid stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="name" {...axis} interval={0} tick={{ fill: "#64748b", fontSize: 11 }} height={44} angle={-20} textAnchor="end" />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} {...axis} tickFormatter={(v: number) => `${v}%`} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="then" name="After first attempt" fill="#c7d2fe" radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="now" name="Mastery now" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Single-series column chart (counts per period). */
export function CountColumns({ data, dataKey, name, height = 220, labelKey = "date" }: { data: Record<string, unknown>[]; dataKey: string; name: string; height?: number; labelKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid stroke="#eef2f7" vertical={false} />
        <XAxis dataKey={labelKey} {...axis} tickFormatter={(d: string) => (/^\d{4}-/.test(d) ? formatDate(d, { day: "numeric", month: "short" }) : d)} minTickGap={12} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip content={<ChartTooltip percent={false} labelFormat={(d) => (/^\d{4}-/.test(d) ? formatDate(d) : d)} />} cursor={{ fill: "#f8fafc" }} />
        <Bar dataKey={dataKey} name={name} fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
