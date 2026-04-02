import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Compass, TrendingUp, Vault, LineChart, User } from "lucide-react";

const tabs = [
  { path: "/", icon: Compass, id: "home", labelKey: "nav.home", accent: "#d4a832" },
  { path: "/trade", icon: TrendingUp, id: "predict", labelKey: "nav.predict", accent: "#dc2626" },
  { path: "/vault", icon: Vault, id: "vault", labelKey: "nav.vault", accent: "#d4a832" },
  { path: "/strategy", icon: LineChart, id: "trade", labelKey: "nav.trade", accent: "#dc2626" },
  { path: "/profile", icon: User, id: "profile", labelKey: "nav.profile", accent: "#d4a832" },
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
      <div className="pointer-events-auto flex items-center justify-around mx-3 mb-2.5 px-2 py-2 w-[calc(100%-1.5rem)] max-w-md rounded-2xl"
        style={{
          background: "linear-gradient(180deg, rgba(16,12,6,0.96) 0%, rgba(8,6,2,0.99) 100%)",
          backdropFilter: "blur(24px) saturate(1.6)",
          WebkitBackdropFilter: "blur(24px) saturate(1.6)",
          border: "1px solid rgba(212,168,50,0.12)",
          boxShadow: "0 -6px 30px rgba(0,0,0,0.5), 0 0 1px rgba(212,168,50,0.15), inset 0 1px 0 rgba(255,255,255,0.04), 0 0 20px rgba(220,38,38,0.04)",
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.path === "/" ? location === "/" : location.startsWith(tab.path);
          const Icon = tab.icon;
          return (
            <Link key={tab.path} href={tab.path} className="flex-1 flex justify-center">
              <button
                className="relative flex flex-col items-center gap-1 py-1.5 px-2 rounded-xl transition-all duration-300"
                style={isActive ? {
                  background: `linear-gradient(180deg, ${tab.accent}18, ${tab.accent}08)`,
                } : undefined}
                data-testid={`nav-${tab.id}`}
              >
                {/* Active top line */}
                {isActive && (
                  <span className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full"
                    style={{ background: tab.accent, boxShadow: `0 0 8px ${tab.accent}80, 0 0 16px ${tab.accent}40` }} />
                )}

                <div className="relative">
                  <Icon
                    className="transition-all duration-300"
                    style={{
                      width: isActive ? 22 : 20,
                      height: isActive ? 22 : 20,
                      color: isActive ? tab.accent : "rgba(255,255,255,0.3)",
                      strokeWidth: isActive ? 2.2 : 1.5,
                      filter: isActive ? `drop-shadow(0 0 8px ${tab.accent}70)` : undefined,
                      transition: "all 0.3s ease",
                    }}
                  />
                </div>
                <span className="text-[9px] font-semibold leading-none transition-all duration-300"
                  style={{ color: isActive ? tab.accent : "rgba(255,255,255,0.2)" }}>
                  {t(tab.labelKey)}
                </span>
              </button>
            </Link>
          );
        })}

        {/* Animated border glow */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: "transparent",
            border: "1px solid transparent",
            backgroundImage: "linear-gradient(rgba(16,12,6,0.96), rgba(8,6,2,0.99)), linear-gradient(135deg, rgba(212,168,50,0.2), rgba(220,38,38,0.15), rgba(212,168,50,0.2))",
            backgroundOrigin: "border-box",
            backgroundClip: "padding-box, border-box",
            animation: "borderGlow 3s ease-in-out infinite",
          }}
        />
      </div>
    </nav>
  );
}
