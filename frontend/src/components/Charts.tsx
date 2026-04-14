import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";

interface ChartItem {
  label: string;
  value: number;
}

interface UsageChartProps {
  data: ChartItem[];
  title: string;
  variant?: "area" | "bar" | "pie" | "line";
  color?: string;
  colors?: string[];
}

export default function Charts({
  data,
  title,
  variant = "area",
  color = "#3380ff",
  colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]
}: UsageChartProps) {
  return (
    <div className="bg-surface-900 border border-surface-700/50 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-surface-200/80 mb-4">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        {variant === "area" ? (
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="label"
              stroke="#475569"
              fontSize={11}
              tickLine={false}
            />
            <YAxis stroke="#475569" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#f1f5f9",
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${title})`}
            />
          </AreaChart>
        ) : variant === "bar" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="label"
              stroke="#475569"
              fontSize={11}
              tickLine={false}
            />
            <YAxis stroke="#475569" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#f1f5f9",
              }}
            />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : variant === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="label"
              stroke="#475569"
              fontSize={11}
              tickLine={false}
            />
            <YAxis stroke="#475569" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#f1f5f9",
              }}
            />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} />
          </LineChart>
        ) : (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              nameKey="label"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#f1f5f9",
              }}
            />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
