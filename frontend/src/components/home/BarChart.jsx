import { useState } from 'react';
import { formatNumber } from '../../utils/german';

// Columns for one series. Each column is a hover target over the full height; a table carries the values
// for screen readers. bars: [{ key, label, axisLabel, value, tooltip }]
export function BarChart({ bars, caption, valueHeader, labelHeader, height = 180 }) {
  const [active, setActive] = useState(null);
  const maximum = Math.max(...bars.map((bar) => bar.value), 1);
  const labelEvery = bars.length > 24 ? 4 : bars.length > 12 ? 2 : 1;
  const activeBar = active === null ? null : bars[active];

  return (
    <figure className="space-y-2">
      <div className="relative" onMouseLeave={() => setActive(null)}>
        <div className="flex items-baseline justify-between text-xs text-muted-foreground" aria-hidden="true">
          <span>{formatNumber(maximum)}</span>
        </div>
        <div
          className="relative flex items-end gap-[2px] border-t border-dashed border-border"
          style={{ height }}
          aria-hidden="true"
        >
          {bars.map((bar, index) => (
            <div
              key={bar.key}
              className="flex h-full flex-1 cursor-default items-end"
              onMouseEnter={() => setActive(index)}
            >
              <div
                className="w-full rounded-t-[4px] transition-opacity"
                style={{
                  height: `${Math.max((bar.value / maximum) * 100, 0.5)}%`,
                  backgroundColor: 'var(--chart-bar)',
                  opacity: active === null || active === index ? 1 : 0.45,
                }}
              />
            </div>
          ))}
          {activeBar && (
            <div
              className="pointer-events-none absolute top-2 z-10 rounded-md bg-[#1a1a1a] px-2.5 py-1.5 text-xs text-white shadow-md dark:bg-[#262626]"
              style={{
                left: `${((active + 0.5) / bars.length) * 100}%`,
                transform: `translateX(${active < bars.length / 4 ? '0' : active > (bars.length * 3) / 4 ? '-100%' : '-50%'})`,
              }}
            >
              <div className="font-semibold">{activeBar.label}</div>
              <div>{activeBar.tooltip}</div>
            </div>
          )}
        </div>
        <div className="flex gap-[2px] border-t border-border pt-1 text-xs text-muted-foreground" aria-hidden="true">
          {bars.map((bar, index) => (
            <span key={bar.key} className="flex-1 text-center tabular-nums">
              {index % labelEvery === 0 || index === bars.length - 1 ? bar.axisLabel ?? bar.label : ''}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="text-sm text-muted-foreground">{caption}</figcaption>
      <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{labelHeader}</th>
            <th scope="col">{valueHeader}</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.key}>
              <th scope="row">{bar.label}</th>
              <td>{formatNumber(bar.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
