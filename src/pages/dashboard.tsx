import { useState, useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { fetchFuturesOI, fetchExchangePrices, getAiForecastSingle, AI_MODEL_LABELS } from "@/lib/api";
import { useCryptoPrices, useBinanceKlines } from "@/hooks/use-crypto-price";
import type { ChartTimeframe } from "@/hooks/use-crypto-price";
import { PriceHeader } from "@/components/dashboard/price-header";
import { PriceChart } from "@/components/dashboard/price-chart";
import { AssetTabs } from "@/components/dashboard/asset-tabs";
import { TrendingFeed } from "@/components/dashboard/trending-feed";
import { AiModelCarousel } from "@/components/dashboard/ai-model-carousel";
import { ExchangeLogo } from "@/components/exchange-logo";
import { formatCompact } from "@/lib/constants";
import { BarChart3, Activity, Globe } from "lucide-react";

interface ForecastResponse {
  model: string;
  asset: string;
  timeframe: string;
  direction: string;
  confidence: number;
  currentPrice: number;
  targetPrice: number;
  reasoning: string;
  forecastPoints: { timestamp: number; time: string; price: number; predicted: boolean }[];
}


export default function Dashboard() {
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const [selectedTimeframe, setSelectedTimeframe] = useState<ChartTimeframe>("1H");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [oiExpanded, setOiExpanded] = useState(false);
  const [epExpanded, setEpExpanded] = useState(false);

  const { data: prices, isLoading: pricesLoading } = useCryptoPrices();
  const { data: klineData, isLoading: chartLoading } = useBinanceKlines(selectedAsset, selectedTimeframe);

  const { data: futuresData, isLoading: oiLoading } = useQuery<{
    positions: Array<{ pair: string; symbol: string; exchange: string; openInterestValue: number; openInterest: number; price: number; priceChange24h: number }>;
    totalOI: number;
  }>({ queryKey: ["dashboard-futures-oi"], queryFn: fetchFuturesOI, staleTime: 60_000 });

  const { data: exchangePrices, isLoading: epLoading } = useQuery<Array<{
    symbol: string; basePrice: number; baseChange: number;
    exchanges: Array<{ exchange: string; pair: string; symbol: string; price: number; change24h: number; isReal?: boolean }>;
  }>>({ queryKey: ["dashboard-exchange-prices"], queryFn: fetchExchangePrices, staleTime: 60_000 });

  // Fire parallel per-model queries — each model shows as soon as it returns
  const modelQueries = useQueries({
    queries: AI_MODEL_LABELS.map((modelLabel) => {
      const lsCacheKey = `forecast:${selectedAsset}:${selectedTimeframe}:${modelLabel}`;
      return {
        queryKey: ["ai-forecast-single", selectedAsset, selectedTimeframe, modelLabel, lang],
        queryFn: async () => {
          const result = await getAiForecastSingle(selectedAsset, selectedTimeframe, modelLabel, lang);
          const forecast = result?.forecasts?.[0] || null;
          if (forecast) try { localStorage.setItem(lsCacheKey, JSON.stringify(forecast)); } catch {}
          return forecast as ForecastResponse | null;
        },
        staleTime: 3 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchInterval: 5 * 60 * 1000,
        placeholderData: (prev: ForecastResponse | null | undefined) => {
          if (prev) return prev;
          try {
            const cached = localStorage.getItem(lsCacheKey);
            if (cached) return JSON.parse(cached) as ForecastResponse;
          } catch {}
          return undefined;
        },
        retry: 1,
      };
    }),
  });

  // Merge all resolved forecasts into a single list (updates progressively)
  const allForecasts = useMemo(() => {
    return modelQueries
      .map(q => q.data)
      .filter((f): f is ForecastResponse => !!f && !!f.model)
      .sort((a, b) => b.confidence - a.confidence);
  }, [modelQueries.map(q => q.data)]);

  const forecastLoading = modelQueries.every(q => q.isLoading);

  // Chart always shows the highest-confidence model (fixed, no switching)
  const chartForecast = useMemo(() => {
    if (!allForecasts.length) return null;
    return allForecasts[0];
  }, [allForecasts]);

  const chartModelName = chartForecast?.model || null;

  // Active model for carousel highlight only (does NOT affect chart)
  const activeModelName = selectedModel || chartModelName;

  const selectedCoin = prices?.find(
    (p) => p.symbol.toUpperCase() === selectedAsset
  );

  // Futures OI: top 3 exchanges for selected asset
  const topOI = useMemo(() => {
    if (futuresData?.positions?.length) {
      return futuresData.positions
        .filter(p => p.symbol === selectedAsset)
        .sort((a, b) => b.openInterestValue - a.openInterestValue);
    }
    // Seed fallback
    const exchanges = ["Binance", "Bybit", "OKX", "Bitget", "dYdX", "HyperLiquid", "Gate.io", "MEXC"];
    const base = selectedAsset === "BTC" ? 3200000000 : selectedAsset === "ETH" ? 1800000000 : 400000000;
    return exchanges.map((ex, i) => {
      const s = ((Math.sin((i + 1) * 9301 + selectedAsset.charCodeAt(0)) % 1) + 1) % 1;
      return { pair: `${selectedAsset}USDT`, symbol: selectedAsset, exchange: ex, openInterestValue: Math.floor(base * (1 - i * 0.12) * (0.8 + s * 0.4)), openInterest: 0, price: 0, priceChange24h: (s - 0.5) * 6 };
    });
  }, [futuresData, selectedAsset]);

  const selectedCoinExchanges = exchangePrices?.find(c => c.symbol === selectedAsset);

  return (
    <div className="space-y-4 pb-24 lg:pb-8 lg:px-6 lg:pt-4" data-testid="page-dashboard">
      <div
        className="rounded-b-2xl lg:rounded-2xl px-3 pb-3 pt-1.5 lg:pt-3"
        style={{ background: "linear-gradient(145deg, rgba(22,16,8,0.95), rgba(14,10,4,0.98))" }}
      >
        <div className="flex items-start justify-between gap-2">
          <PriceHeader coin={selectedCoin} isLoading={pricesLoading} />
          <button
            onClick={() => navigate(`/market?coin=${selectedAsset}`)}
            className="mt-0.5 shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200 active:translate-y-[1px] active:shadow-none"
            style={{
              background: "linear-gradient(145deg, rgba(212,175,55,0.20) 0%, rgba(209,10,26,0.10) 100%)",
              border: "1px solid rgba(212,175,55,0.25)",
              boxShadow: "0 2px 8px rgba(212,175,55,0.18), inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 2px rgba(0,0,0,0.3)",
            }}
            data-testid="button-market-analysis"
          >
            <BarChart3 className="h-4 w-4 text-primary" />
          </button>
        </div>
        <PriceChart
          ohlcData={klineData}
          isLoading={chartLoading}
          forecast={chartForecast || null}
          forecastLoading={forecastLoading}
          selectedTimeframe={selectedTimeframe}
          onTimeframeChange={setSelectedTimeframe}
          activeModel={chartModelName || undefined}
        />
      </div>

      <div className="px-4 lg:px-0">
        <AssetTabs selected={selectedAsset} onChange={setSelectedAsset} />
      </div>

      {/* AI Model Carousel */}
      <div className="px-4 lg:px-0">
        <AiModelCarousel
          forecasts={allForecasts}
          isLoading={forecastLoading}
          activeModel={activeModelName || null}
          onSelectModel={setSelectedModel}
        />
      </div>

      {/* Desktop: two-column grid for OI + trending */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-4 space-y-4 lg:space-y-0">
        <div className="px-4 lg:px-0">
          <div className="glass-card rounded-2xl p-4 relative overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold">{t("dashboard.futuresOI")}</h3>
            </div>
            {oiLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 rounded bg-muted/20 animate-pulse" />)}</div>
            ) : topOI.length > 0 ? (
              <div className="space-y-2">
                {(oiExpanded ? topOI : topOI.slice(0, 3)).map((item) => {
                  const maxOI = topOI[0].openInterestValue;
                  const pct = (item.openInterestValue / maxOI) * 100;
                  return (
                    <div key={`${item.exchange}-${item.pair}`} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <ExchangeLogo name={item.exchange} size={14} />
                          <span className="font-medium">{item.exchange}</span>
                        </div>
                        <span className="font-mono tabular-nums text-primary">{formatCompact(item.openInterestValue)}</span>
                      </div>
                      <div className="h-1 rounded-full bg-muted/20 overflow-hidden">
                        <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%`, transition: "width 0.5s ease" }} />
                      </div>
                    </div>
                  );
                })}
                {topOI.length > 3 && (
                  <button onClick={() => setOiExpanded(v => !v)} className="text-[11px] text-primary hover:underline mt-1">
                    {oiExpanded ? t("dashboard.collapse") : t("dashboard.expandMore", { count: topOI.length - 3 })}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("common.noData")}</p>
            )}
          </div>
        </div>

        <div className="px-4 lg:px-0">
          <div className="glass-card rounded-2xl p-4 relative overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <TrendingFeed prices={prices} isLoading={pricesLoading} />
          </div>
        </div>
      </div>

      {/* Cross-Exchange Prices */}
      <div className="px-4 lg:px-0">
        <div className="glass-card rounded-2xl p-4 relative overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">{t("dashboard.crossExchange")}</h3>
          </div>
          {epLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-6 rounded bg-muted/20 animate-pulse" />)}</div>
          ) : selectedCoinExchanges ? (
            <div className="space-y-1">
              {selectedCoinExchanges.exchanges.slice(0, epExpanded ? 20 : 5).map((row) => {
                const isPos = row.change24h >= 0;
                return (
                  <div key={row.exchange} className="flex items-center justify-between text-xs py-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center gap-1.5">
                      <ExchangeLogo name={row.exchange} size={14} />
                      <span className="font-medium">{row.exchange}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono tabular-nums">${selectedAsset === "DOGE" ? row.price.toFixed(5) : row.price.toFixed(2)}</span>
                      <span className={`font-mono tabular-nums ${isPos ? "text-emerald-400" : "text-red-400"}`}>
                        {isPos ? "+" : ""}{row.change24h.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })}
              {selectedCoinExchanges.exchanges.length > 5 && (
                <button onClick={() => setEpExpanded(v => !v)} className="text-[11px] text-primary hover:underline mt-1">
                  {epExpanded ? t("dashboard.collapse") : t("dashboard.expandMore", { count: selectedCoinExchanges.exchanges.length - 5 })}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("common.noData")}</p>
          )}
        </div>
      </div>

      {/* Analysis Page Button */}
      <div className="px-4 lg:px-0 pb-2">
        <button
          onClick={() => navigate(`/market?coin=${selectedAsset}`)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold transition-all active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, rgba(212,168,50,0.12), rgba(212,168,50,0.06))",
            border: "1px solid rgba(212,168,50,0.2)",
            color: "hsl(43,74%,52%)",
          }}
        >
          <BarChart3 className="h-4 w-4" />
          {t("dashboard.goToAnalysis")}
        </button>
      </div>
    </div>
  );
}
