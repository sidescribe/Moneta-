import { useMemo, useState } from 'react';
import type { Transaction } from '../../types';
import { buildMonthlyChart, buildCashFlowTrend } from '../../lib/charts';

interface MonthlyBarChartProps {
  transactions: Transaction[];
  monthsBack?: number;
}

interface Tooltip {
  x: number;
  y: number;
  label: string;
  income: number;
  expenses: number;
  net: number;
  cumulative: number;
}

const PADDING = { top: 40, right: 24, bottom: 52, left: 64 };
const LEGEND_HEIGHT = 28;

export default function MonthlyBarChart({
  transactions,
  monthsBack = 12,
}: MonthlyBarChartProps) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const monthly = useMemo(
    () => buildMonthlyChart(transactions, monthsBack),
    [transactions, monthsBack],
  );

  const cashFlow = useMemo(
    () => buildCashFlowTrend(transactions, monthsBack),
    [transactions, monthsBack],
  );

  const hasData = monthly.some(p => p.income > 0 || p.expenses > 0);

  const allValues = useMemo(() => {
    const bars = monthly.flatMap(p => [p.income, p.expenses]);
    const cums = cashFlow.map(c => c.cumulativeNet);
    return [...bars, ...cums];
  }, [monthly, cashFlow]);

  const yMax = useMemo(() => Math.max(...allValues, 1), [allValues]);
  const yMin = useMemo(() => Math.min(...allValues, 0), [allValues]);

  const viewW = 600;
  const viewH = 340 + LEGEND_HEIGHT;
  const chartW = viewW - PADDING.left - PADDING.right;
  const chartH = viewH - PADDING.top - PADDING.bottom - LEGEND_HEIGHT;

  const yRange = yMax - yMin || 1;
  const yScale = (v: number) =>
    PADDING.top + chartH - ((v - yMin) / yRange) * chartH;
  const zeroY = yScale(0);

  const n = monthly.length;
  const groupWidth = chartW / n;
  const barWidth = groupWidth * 0.3;
  const gap = groupWidth * 0.06;

  const gridLines = useMemo(() => {
    const target = 5;
    const raw = yRange / target;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const steps = [1, 2, 2.5, 5, 10];
    const step = mag * (steps.find(s => s * mag >= raw) ?? 10);
    const lines: number[] = [];
    let v = Math.ceil(yMin / step) * step;
    while (v <= yMax) {
      lines.push(v);
      v += step;
    }
    return lines;
  }, [yMin, yMax, yRange]);

  function fmt(v: number) {
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  }

  function handleGroupHover(i: number, entering: boolean) {
    if (!entering) {
      setTooltip(null);
      return;
    }
    const p = monthly[i];
    const cf = cashFlow[i];
    const x = PADDING.left + groupWidth * i + groupWidth / 2;
    const y = Math.min(yScale(p.income), yScale(p.expenses)) - 8;
    setTooltip({
      x,
      y,
      label: p.label,
      income: p.income,
      expenses: p.expenses,
      net: p.net,
      cumulative: cf.cumulativeNet,
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-soft p-5">
      <h3 className="text-base font-semibold text-neutral-900 mb-4">
        Income vs Expenses
      </h3>

      {!hasData ? (
        <div className="flex items-center justify-center h-48 text-sm text-neutral-500">
          No transaction data to display for this period.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${viewW} ${viewH}`}
          className="w-full h-auto"
          role="img"
          aria-label="Monthly income vs expenses bar chart"
        >
          {/* gridlines */}
          {gridLines.map(v => (
            <g key={v}>
              <line
                x1={PADDING.left}
                y1={yScale(v)}
                x2={viewW - PADDING.right}
                y2={yScale(v)}
                stroke="#e5e5e5"
                strokeDasharray={v === 0 ? undefined : '4 3'}
                strokeWidth={v === 0 ? 1.2 : 0.8}
              />
              <text
                x={PADDING.left - 8}
                y={yScale(v) + 3.5}
                textAnchor="end"
                className="fill-neutral-500"
                fontSize="10"
              >
                {fmt(v)}
              </text>
            </g>
          ))}

          {/* bars */}
          {monthly.map((p, i) => {
            const gx = PADDING.left + groupWidth * i;
            const cx = gx + groupWidth / 2;
            const incomeH = (p.income / yRange) * chartH;
            const expenseH = (p.expenses / yRange) * chartH;
            return (
              <g
                key={i}
                onMouseEnter={() => handleGroupHover(i, true)}
                onMouseLeave={() => handleGroupHover(i, false)}
                className="cursor-pointer"
              >
                {/* invisible hit area */}
                <rect
                  x={gx}
                  y={PADDING.top}
                  width={groupWidth}
                  height={chartH}
                  fill="transparent"
                />
                {/* income bar */}
                {p.income > 0 && (
                  <rect
                    x={cx - barWidth - gap / 2}
                    y={zeroY - incomeH}
                    width={barWidth}
                    height={incomeH}
                    rx="3"
                    className="fill-emerald-500"
                  >
                    <title>
                      {p.label} Income: ${p.income.toFixed(2)}
                    </title>
                  </rect>
                )}
                {/* expense bar */}
                {p.expenses > 0 && (
                  <rect
                    x={cx + gap / 2}
                    y={zeroY - expenseH}
                    width={barWidth}
                    height={expenseH}
                    rx="3"
                    className="fill-red-500"
                  >
                    <title>
                      {p.label} Expenses: ${p.expenses.toFixed(2)}
                    </title>
                  </rect>
                )}
                {/* month label */}
                <text
                  x={cx}
                  y={viewH - LEGEND_HEIGHT - 8}
                  textAnchor="middle"
                  className="fill-neutral-600"
                  fontSize="10"
                >
                  {p.label}
                </text>
              </g>
            );
          })}

          {/* cash flow trend line */}
          {cashFlow.length > 1 && (
            <polyline
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={cashFlow
                .map((c, i) => {
                  const x =
                    PADDING.left + groupWidth * i + groupWidth / 2;
                  const y = yScale(c.cumulativeNet);
                  return `${x},${y}`;
                })
                .join(' ')}
            />
          )}

          {/* trend dots */}
          {cashFlow.map((c, i) => (
            <circle
              key={i}
              cx={PADDING.left + groupWidth * i + groupWidth / 2}
              cy={yScale(c.cumulativeNet)}
              r="3"
              className="fill-blue-500"
            >
              <title>
                {monthly[i]?.label} Cash Flow: ${c.cumulativeNet.toFixed(2)}
              </title>
            </circle>
          ))}

          {/* tooltip */}
          {tooltip && (
            <g>
              <rect
                x={Math.min(tooltip.x - 72, viewW - PADDING.right - 148)}
                y={Math.max(tooltip.y - 68, PADDING.top)}
                width="148"
                height="64"
                rx="8"
                className="fill-neutral-800"
                opacity="0.92"
              />
              <text
                x={Math.min(tooltip.x, viewW - PADDING.right - 74)}
                y={Math.max(tooltip.y - 48, PADDING.top + 16)}
                textAnchor="middle"
                fill="white"
                fontSize="10"
                fontWeight="600"
              >
                {tooltip.label}
              </text>
              <text
                x={Math.min(tooltip.x - 56, viewW - PADDING.right - 132)}
                y={Math.max(tooltip.y - 32, PADDING.top + 32)}
                fill="#6ee7b7"
                fontSize="9"
              >
                Income: ${tooltip.income.toFixed(2)}
              </text>
              <text
                x={Math.min(tooltip.x - 56, viewW - PADDING.right - 132)}
                y={Math.max(tooltip.y - 19, PADDING.top + 45)}
                fill="#fca5a5"
                fontSize="9"
              >
                Expense: ${tooltip.expenses.toFixed(2)}
              </text>
              <text
                x={Math.min(tooltip.x - 56, viewW - PADDING.right - 132)}
                y={Math.max(tooltip.y - 6, PADDING.top + 58)}
                fill="#93c5fd"
                fontSize="9"
              >
                Cash Flow: ${tooltip.cumulative.toFixed(2)}
              </text>
            </g>
          )}

          {/* legend */}
          <g transform={`translate(${PADDING.left}, ${viewH - LEGEND_HEIGHT + 8})`}>
            <circle cx="0" cy="0" r="4" className="fill-emerald-500" />
            <text x="8" y="3.5" fontSize="10" className="fill-neutral-600">
              Income
            </text>
            <circle cx="64" cy="0" r="4" className="fill-red-500" />
            <text x="72" y="3.5" fontSize="10" className="fill-neutral-600">
              Expenses
            </text>
            <circle cx="144" cy="0" r="4" className="fill-blue-500" />
            <text x="152" y="3.5" fontSize="10" className="fill-neutral-600">
              Cash Flow
            </text>
          </g>
        </svg>
      )}
    </div>
  );
}
