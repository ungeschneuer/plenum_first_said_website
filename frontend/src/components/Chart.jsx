import { forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import { useTheme } from '../hooks/useTheme';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
);

const Chart = forwardRef(({ timelineData, showPercentage, chartType = 'line', aggregation = 'protocol' }, ref) => {
  const navigate = useNavigate();
  const chartRef = useRef(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useImperativeHandle(ref, () => ({
    resetZoom: () => {
      if (chartRef.current) {
        chartRef.current.resetZoom();
      }
    }
  }));

  if (!timelineData || timelineData.length === 0) {
    return (
      <Alert>
        <AlertDescription>Keine Daten verfügbar</AlertDescription>
      </Alert>
    );
  }

  const aggregatedData = useMemo(() => {
    if (!timelineData || timelineData.length === 0) return [];
    if (aggregation === 'protocol') return timelineData;

    const aggregated = {};

    timelineData.forEach(point => {
      const date = new Date(point.date);
      let key;

      if (aggregation === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (aggregation === 'year') {
        key = String(date.getFullYear());
      } else if (aggregation === 'legislature') {
        key = `WP ${point.wahlperiode}`;
      }

      if (!aggregated[key]) {
        aggregated[key] = {
          date: key,
          count: 0,
          total_words: 0,
          wahlperiode: point.wahlperiode,
          protocol_id: point.protocol_id,
        };
      }

      aggregated[key].count += point.count;
      aggregated[key].total_words += point.total_words || 0;
    });

    return Object.values(aggregated).map(item => ({
      ...item,
      percentage: item.total_words > 0 ? (item.count / item.total_words) * 100 : 0,
    })).sort((a, b) => {
      if (aggregation === 'legislature') {
        return parseInt(a.date.replace('WP ', '')) - parseInt(b.date.replace('WP ', ''));
      }
      return a.date.localeCompare(b.date);
    });
  }, [timelineData, aggregation]);
  const labels = aggregatedData.map(point => point.date);
  const values = showPercentage
    ? aggregatedData.map(point => point.percentage)
    : aggregatedData.map(point => point.count);

  // Generate dataset based on chart type
  const getDatasetConfig = () => {
    const baseConfig = {
      label: showPercentage ? 'Prozentsatz (%)' : 'Worthäufigkeit',
      data: values,
      borderColor: 'hsl(var(--primary))',
      backgroundColor: 'hsl(var(--primary) / 0.1)',
    };

    if (chartType === 'line') {
      return {
        ...baseConfig,
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: 'hsl(var(--primary))',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        fill: false,
      };
    } else if (chartType === 'bar') {
      return {
        ...baseConfig,
        borderWidth: 0,
        borderRadius: 4,
      };
    }
    return baseConfig;
  };

  const data = {
    labels,
    datasets: [getDatasetConfig()]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (event, elements) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const point = aggregatedData[index];
        if (point.protocol_id) {
          navigate(`/protokoll/${point.protocol_id}`);
        }
      }
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            family: 'system-ui, -apple-system, sans-serif',
            size: 12
          },
          padding: 15,
          usePointStyle: true,
          color: isDark ? '#e0e0e0' : '#1a1a1a',
        }
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const point = aggregatedData[context.dataIndex];
            const value = showPercentage
              ? `${point.percentage.toFixed(4)}%`
              : point.count;
            const labels = [`Wert: ${value}`];

            if (aggregation === 'protocol') {
              labels.push(`Protokoll: WP ${point.wahlperiode}/${point.protokollnummer}`);
              labels.push(`Datum: ${point.date}`);
              labels.push('Klicken zum Öffnen');
            } else {
              labels.push(`Zeitraum: ${point.date}`);
              if (aggregation === 'legislature') {
                labels.push(`Wahlperiode ${point.wahlperiode}`);
              }
            }

            return labels;
          }
        },
        backgroundColor: isDark ? 'rgba(26, 26, 26, 0.95)' : 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 13,
          weight: 'bold'
        },
        bodyFont: {
          size: 12
        },
        titleColor: isDark ? '#e0e0e0' : '#ffffff',
        bodyColor: isDark ? '#e0e0e0' : '#ffffff',
        borderColor: isDark ? '#333333' : '#e0e0e0',
        borderWidth: 1,
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true
          },
          mode: 'x',
        },
        limits: {
          x: {min: 'original', max: 'original'},
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: showPercentage ? 'Prozentsatz der Gesamtwörter (%)' : 'Worthäufigkeit',
          font: {
            size: 12,
            weight: '500'
          },
          color: isDark ? '#e0e0e0' : '#1a1a1a',
        },
        grid: {
          color: isDark ? '#333333' : '#e0e0e0',
        },
        ticks: {
          font: {
            size: 11
          },
          color: isDark ? '#888888' : '#666666',
          precision: 0,
          stepSize: 1,
          callback: function(value) {
            if (showPercentage) {
              return value;
            }
            return Math.floor(value);
          }
        }
      },
      x: {
        title: {
          display: true,
          text: 'Datum',
          font: {
            size: 12,
            weight: '500'
          },
          color: isDark ? '#e0e0e0' : '#1a1a1a',
        },
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11
          },
          color: isDark ? '#888888' : '#666666',
          maxRotation: 45,
          minRotation: 45,
        }
      }
    }
  };

  // Select chart component based on type
  const ChartComponent = chartType === 'bar' ? Bar : Line;

  return (
    <div className="h-[400px] w-full">
      <ChartComponent ref={chartRef} data={data} options={options} />
    </div>
  );
});

Chart.displayName = 'Chart';

export default Chart;
