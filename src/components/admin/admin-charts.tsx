"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type AdminChartPoint = {
  date: string;
  billVolume: number;
  referralSignups: number;
  newBusinesses: number;
  activeBusinesses: number;
};

export function AdminCharts({ series }: { series: AdminChartPoint[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Bill volume">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#292F36" />
            <XAxis dataKey="date" stroke="#A7ADB5" fontSize={11} />
            <YAxis stroke="#A7ADB5" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: "#171B20",
                border: "1px solid #292F36",
                borderRadius: 8,
              }}
            />
            <Area
              type="monotone"
              dataKey="billVolume"
              stroke="#D4AF37"
              fill="#D4AF37"
              fillOpacity={0.2}
              name="Bill volume"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Referral signups">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#292F36" />
            <XAxis dataKey="date" stroke="#A7ADB5" fontSize={11} />
            <YAxis stroke="#A7ADB5" fontSize={11} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "#171B20",
                border: "1px solid #292F36",
                borderRadius: 8,
              }}
            />
            <Area
              type="monotone"
              dataKey="referralSignups"
              stroke="#E3C65A"
              fill="#E3C65A"
              fillOpacity={0.2}
              name="Referral signups"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="New businesses">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#292F36" />
            <XAxis dataKey="date" stroke="#A7ADB5" fontSize={11} />
            <YAxis stroke="#A7ADB5" fontSize={11} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "#171B20",
                border: "1px solid #292F36",
                borderRadius: 8,
              }}
            />
            <Area
              type="monotone"
              dataKey="newBusinesses"
              stroke="#A7ADB5"
              fill="#A7ADB5"
              fillOpacity={0.15}
              name="New businesses"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Active businesses">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#292F36" />
            <XAxis dataKey="date" stroke="#A7ADB5" fontSize={11} />
            <YAxis stroke="#A7ADB5" fontSize={11} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "#171B20",
                border: "1px solid #292F36",
                borderRadius: 8,
              }}
            />
            <Area
              type="monotone"
              dataKey="activeBusinesses"
              stroke="#D4AF37"
              fill="#D4AF37"
              fillOpacity={0.12}
              name="Active businesses"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

/** Compact two-series chart for a single business detail page. */
export function BusinessTrendCharts({
  series,
}: {
  series: { date: string; billVolume: number; billCount: number }[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Bill volume over time">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#292F36" />
            <XAxis dataKey="date" stroke="#A7ADB5" fontSize={11} />
            <YAxis stroke="#A7ADB5" fontSize={11} />
            <Tooltip
              contentStyle={{
                background: "#171B20",
                border: "1px solid #292F36",
                borderRadius: 8,
              }}
            />
            <Area
              type="monotone"
              dataKey="billVolume"
              stroke="#D4AF37"
              fill="#D4AF37"
              fillOpacity={0.2}
              name="Bill volume"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Invoices per day">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#292F36" />
            <XAxis dataKey="date" stroke="#A7ADB5" fontSize={11} />
            <YAxis stroke="#A7ADB5" fontSize={11} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "#171B20",
                border: "1px solid #292F36",
                borderRadius: 8,
              }}
            />
            <Area
              type="monotone"
              dataKey="billCount"
              stroke="#E3C65A"
              fill="#E3C65A"
              fillOpacity={0.2}
              name="Invoices"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}
