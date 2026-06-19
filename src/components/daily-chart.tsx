'use client'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface Props {
  data: Record<string, string | number>[]
  variants: { label: string; color: string }[]
}

function formatRate(value: unknown) {
  if (typeof value !== 'number') return ''
  return (value * 100).toFixed(2) + '%'
}

export function DailyChart({ data, variants }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-zinc-400 text-sm">
        Sem dados ainda
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a1a1aa', fontFamily: 'var(--font-geist-mono)' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={v => (v * 100).toFixed(0) + '%'} tick={{ fontSize: 11, fill: '#a1a1aa', fontFamily: 'var(--font-geist-mono)' }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={formatRate}
          contentStyle={{ borderRadius: 8, border: '1px solid #f0f0f0', boxShadow: '0 4px 12px rgba(0,0,0,.06)', fontFamily: 'var(--font-geist-sans)', fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font-geist-sans)' }} />
        {variants.map(v => (
          <Line
            key={v.label}
            type="monotone"
            dataKey={v.label}
            stroke={v.color}
            strokeWidth={2}
            dot={false}
            name={`Variante ${v.label}`}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
