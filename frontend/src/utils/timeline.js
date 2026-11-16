// Sums a word's timeline per session, month, year or electoral term. Shares are summed counts over summed words,
// never an average of shares. Every point carries the date it is drawn at on the time axis.

const PERIOD_OF = {
  protocol: (point) => point.protocol_id,
  month: (point) => point.date.slice(0, 7),
  year: (point) => point.date.slice(0, 4),
  legislature: (point) => `WP ${point.wahlperiode}`,
};

function periodLabel(aggregation, key, firstPoint) {
  if (aggregation === 'legislature') return `${firstPoint.wahlperiode}. Wahlperiode`;
  if (aggregation === 'protocol') return `Sitzung ${firstPoint.wahlperiode}/${firstPoint.protokollnummer}`;
  return key;
}

export function aggregateTimeline(points, aggregation) {
  if (aggregation === 'protocol') {
    return points.map((point) => ({ ...point, x: point.date, label: periodLabel('protocol', null, point) }));
  }
  const periods = new Map();
  for (const point of points) {
    const key = PERIOD_OF[aggregation](point);
    if (!periods.has(key)) {
      periods.set(key, { x: point.date, label: periodLabel(aggregation, key, point), count: 0, total_words: 0,
                         wahlperiode: point.wahlperiode });
    }
    const period = periods.get(key);
    period.count += point.count;
    period.total_words += point.total_words || 0;
  }
  return [...periods.values()].map((period) => ({
    ...period,
    percentage: period.total_words > 0 ? (period.count / period.total_words) * 100 : 0,
  }));
}
