import React, { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { Loader2 } from 'lucide-react';
import { getSubscriptions, info } from './hlClient';

const INTERVALS = [
  { id: '1m', label: '1m', ms: 60_000 },
  { id: '5m', label: '5m', ms: 5 * 60_000 },
  { id: '15m', label: '15m', ms: 15 * 60_000 },
  { id: '1h', label: '1H', ms: 3600_000 },
  { id: '4h', label: '4H', ms: 4 * 3600_000 },
  { id: '1d', label: '1D', ms: 86400_000 },
] as const;
type Interval = (typeof INTERVALS)[number]['id'];

const UP = '#10b981';
const DOWN = '#ef4444';
const BARS = 400;

interface Bar {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
}

const toCandle = (b: Bar) => ({
  time: Math.floor(b.t / 1000) as UTCTimestamp,
  open: Number(b.o),
  high: Number(b.h),
  low: Number(b.l),
  close: Number(b.c),
});
const toVolume = (b: Bar) => ({
  time: Math.floor(b.t / 1000) as UTCTimestamp,
  value: Number(b.v),
  color: Number(b.c) >= Number(b.o) ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)',
});

/** Price precision shown on the chart axis for a given price level. */
const precisionFor = (px: number) => (px >= 1000 ? 1 : px >= 10 ? 2 : px >= 1 ? 4 : px >= 0.01 ? 5 : 7);

export const FuturesChart: React.FC<{ coin: string; refPrice: number }> = ({ coin, refPrice }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const [interval, setIntervalId] = useState<Interval>(() => {
    try {
      return (localStorage.getItem('nova_hl_interval') as Interval) || '15m';
    } catch {
      return '15m';
    }
  });
  const [loading, setLoading] = useState(true);

  // Create the chart once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#6b7280',
        fontSize: 11,
      },
      grid: { vertLines: { color: '#f3f4f6' }, horzLines: { color: '#f3f4f6' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#e5e7eb' },
      timeScale: { borderColor: '#e5e7eb', timeVisible: true, secondsVisible: false },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });
    const volume = chart.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' } });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    candles.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.22 } });
    chartRef.current = chart;
    candleRef.current = candles;
    volumeRef.current = volume;
    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, []);

  // Price precision follows the coin's price level
  const precision = precisionFor(refPrice || 1);
  useEffect(() => {
    candleRef.current?.applyOptions({
      priceFormat: { type: 'price', precision, minMove: 1 / 10 ** precision },
    });
  }, [precision, coin]);

  // History + live candles for the selected coin and interval
  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | null = null;
    const ms = INTERVALS.find((i) => i.id === interval)!.ms;
    setLoading(true);
    candleRef.current?.setData([]);
    volumeRef.current?.setData([]);

    info
      .candleSnapshot({ coin, interval, startTime: Date.now() - BARS * ms })
      .then((bars) => {
        if (!alive || !candleRef.current) return;
        candleRef.current.setData(bars.map(toCandle));
        volumeRef.current?.setData(bars.map(toVolume));
        chartRef.current?.timeScale().scrollToRealTime();
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));

    getSubscriptions()
      .candle({ coin, interval }, (bar) => {
        if (!alive || bar.s !== coin) return;
        try {
          candleRef.current?.update(toCandle(bar));
          volumeRef.current?.update(toVolume(bar));
        } catch {
          // an out-of-order bar right after switching interval; the next one fixes it
        }
      })
      .then((sub) => {
        if (alive) unsubscribe = () => void sub.unsubscribe().catch(() => {});
        else sub.unsubscribe().catch(() => {});
      })
      .catch(() => {});

    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [coin, interval]);

  const pickInterval = (id: Interval) => {
    setIntervalId(id);
    try {
      localStorage.setItem('nova_hl_interval', id);
    } catch {}
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100">
        {INTERVALS.map((i) => (
          <button
            key={i.id}
            type="button"
            onClick={() => pickInterval(i.id)}
            className={`px-2 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
              interval === i.id ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {i.label}
          </button>
        ))}
        {loading && <Loader2 size={13} className="ml-auto animate-spin text-gray-400" />}
      </div>
      <div ref={containerRef} className="relative flex-1 min-h-[300px] sm:min-h-[380px]" />
    </div>
  );
};
