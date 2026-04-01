import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Compass, CandlestickChart, Vault, Cpu, Hexagon } from "lucide-react";

const tabs = [
  { path: "/", icon: Compass, id: "home", labelKey: "nav.home" },
  { path: "/trade", icon: CandlestickChart, id: "trade", labelKey: "nav.trade" },
  { path: "/vault", icon: Vault, id: "vault", labelKey: "nav.vault" },
  { path: "/strategy", icon: Cpu, id: "strategy", labelKey: "nav.strategy" },
  { path: "/profile/nodes", icon: Hexagon, id: "nodes", labelKey: "nav.nodes" },
];

export function BottomNav() {
  const [location] = useLocation();
  const { t } = useTranslation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      data-testid="bottom-nav"
    >
      <div className="pointer-events-auto flex items-center justify-around mx-3 mb-2.5 px-1 py-1.5 w-[calc(100%-1.5rem)] max-w-md rounded-2xl"
        style={{
          background: "linear-gradient(180deg, rgba(18,14,8,0.95) 0%, rgba(10,8,4,0.98) 100%)",
          backdropFilter: "blur(20px) saturate(1.5)",
          WebkitBackdropFilter: "blur(20px) saturate(1.5)",
          border: "1px solid rgba(212,168,50,0.06)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.4), 0 0 1px rgba(212,168,50,0.08), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.path === "/" ? location === "/" : location.startsWith(tab.path);
          const Icon = tab.icon;
          return (
            <Link key={tab.path} href={tab.path} className="flex-1 flex justify-center">
              <button
                className="relative flex flex-col items-center gap-0.5 py-1 px-1 rounded-xl transition-all duration-300"
                style={isActive ? {
                  background: "rgba(212,168,50,0.08)",
                } : undefined}
                data-testid={`nav-${tab.id}`}
              >
                <div className="relative">
                  <Icon
                    className={`transition-all duration-300 ${
                      isActive
                        ? "h-[20px] w-[20px] text-primary"
                        : "h-[18px] w-[18px] text-foreground/25"
                    }`}
                    strokeWidth={isActive ? 2.2 : 1.6}
                    style={isActive ? { filter: "drop-shadow(0 0 6px rgba(212,168,50,0.5))" } : undefined}
                  />
                  {isActive && (
                    <span className="absolute -top-0.5 -right-0.5 h-1 w-1 rounded-full bg-primary animate-pulse"
                      style={{ boxShadow: "0 0 4px rgba(212,168,50,0.6)" }} />
                  )}
                </div>
                <span className={`text-[9px] font-medium leading-none transition-all duration-300 ${
                  isActive ? "text-primary" : "text-foreground/20"
                }`}>
                  {t(tab.labelKey)}
                </span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
