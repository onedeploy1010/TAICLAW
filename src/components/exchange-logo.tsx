import { useState } from "react";

const EXCHANGE_DOMAINS: Record<string, string> = {
  Binance: "binance.com",
  OKX: "okx.com",
  Bybit: "bybit.com",
  Bitget: "bitget.com",
  Kraken: "kraken.com",
  Coinbase: "coinbase.com",
  Gate: "gate.io",
  MEXC: "mexc.com",
  CoinEx: "coinex.com",
  LBank: "lbank.com",
  Hyperliquid: "hyperliquid.xyz",
  Bitmex: "bitmex.com",
  "Crypto.com": "crypto.com",
  Bitunix: "bitunix.com",
  KuCoin: "kucoin.com",
  Huobi: "htx.com",
};

function getLogoUrl(name: string, size: number): string | null {
  const domain = EXCHANGE_DOMAINS[name];
  if (!domain) return null;
  const sz = size <= 16 ? 32 : 64;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${sz}`;
}

const EXCHANGE_COLORS: Record<string, string> = {
  Binance: "#F0B90B",
  OKX: "#fff",
  Bybit: "#F7A600",
  Coinbase: "#0052FF",
  Bitget: "#00F0FF",
  Gate: "#2354E6",
  KuCoin: "#23AF5F",
  Kraken: "#5741D9",
  MEXC: "#1972E2",
  CoinEx: "#46C8A3",
  LBank: "#1C6BF5",
  Hyperliquid: "#00D1A9",
  Bitmex: "#F7931A",
  "Crypto.com": "#002D74",
  Bitunix: "#3B82F6",
  Huobi: "#2BAE73",
};

export function getExchangeColor(name: string) {
  return EXCHANGE_COLORS[name] || "#888";
}

interface ExchangeLogoProps {
  name: string;
  size?: number;
  className?: string;
}

function Fallback({ name, size, color, className }: { name: string; size: number; color: string; className: string }) {
  return (
    <div
      className={`rounded shrink-0 flex items-center justify-center font-bold text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.45, backgroundColor: color }}
    >
      {name[0]}
    </div>
  );
}

export function ExchangeLogo({ name, size = 16, className = "" }: ExchangeLogoProps) {
  const [failed, setFailed] = useState(false);
  const url = getLogoUrl(name, size);
  const color = EXCHANGE_COLORS[name] || "#888";

  if (!url || failed) {
    return <Fallback name={name} size={size} color={color} className={className} />;
  }

  return (
    <img
      src={url}
      alt={name}
      className={`rounded shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
      loading="eager"
      onError={() => setFailed(true)}
    />
  );
}
