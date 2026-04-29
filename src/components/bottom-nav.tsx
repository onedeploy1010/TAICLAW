import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { motion, LayoutGroup } from "framer-motion";
import { LayoutDashboard, Eye, Shield, BarChart2, User } from "lucide-react";

const TABS = [
  {
    path: "/",
    icon: LayoutDashboard,
    id: "home",
    zhLabel: "符阁",
    enLabel: "HALL",
    accent: "#d4a832",
    glow: "rgba(212,168,50,0.6)",
    pillBg: "rgba(212,168,50,0.15)",
  },
  {
    path: "/trade",
    icon: Eye,
    id: "predict",
    zhLabel: "符见",
    enLabel: "SIGHT",
    accent: "#ef4444",
    glow: "rgba(239,68,68,0.6)",
    pillBg: "rgba(239,68,68,0.15)",
  },
  {
    path: "/vault",
    icon: Shield,
    id: "vault",
    zhLabel: "符库",
    enLabel: "VAULT",
    accent: "#d4a832",
    glow: "rgba(212,168,50,0.6)",
    pillBg: "rgba(212,168,50,0.15)",
  },
  {
    path: "/strategy",
    icon: BarChart2,
    id: "trade",
    zhLabel: "符市",
    enLabel: "MARKET",
    accent: "#ef4444",
    glow: "rgba(239,68,68,0.6)",
    pillBg: "rgba(239,68,68,0.15)",
  },
  {
    path: "/profile",
    icon: User,
    id: "profile",
    zhLabel: "符身",
    enLabel: "SELF",
    accent: "#d4a832",
    glow: "rgba(212,168,50,0.6)",
    pillBg: "rgba(212,168,50,0.15)",
  },
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
      <LayoutGroup>
        <div
          className="pointer-events-auto relative flex items-stretch justify-around mx-3 mb-2.5 w-[calc(100%-1.5rem)] max-w-md rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(180deg, rgba(22,16,6,0.97) 0%, rgba(14,10,4,0.99) 100%)",
            backdropFilter: "blur(24px) saturate(1.6)",
            WebkitBackdropFilter: "blur(24px) saturate(1.6)",
            border: "1px solid rgba(212,168,50,0.22)",
            boxShadow: "0 -4px 32px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(212,168,50,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* Top shimmer line */}
          <div
            className="absolute top-0 left-0 right-0 h-px pointer-events-none"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(212,168,50,0.45) 30%, rgba(239,68,68,0.35) 70%, transparent 100%)",
            }}
          />

          {TABS.map((tab) => {
            const isActive = tab.path === "/" ? location === "/" : location.startsWith(tab.path);
            const Icon = tab.icon;

            return (
              <Link key={tab.path} href={tab.path} className="flex-1">
                <motion.button
                  className="relative flex flex-col items-center justify-center w-full py-2.5 px-1 gap-0.5"
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  data-testid={`nav-${tab.id}`}
                >
                  {/* Sliding pill - renders only on active, layoutId moves it */}
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-x-1 inset-y-1 rounded-xl"
                      style={{ background: tab.pillBg }}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}

                  {/* Top glow line - also slides with layoutId */}
                  {isActive && (
                    <motion.span
                      layoutId="nav-topline"
                      className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                      style={{
                        width: 32,
                        height: 2,
                        background: tab.accent,
                        boxShadow: `0 0 10px ${tab.glow}, 0 0 22px ${tab.glow}80`,
                      }}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}

                  {/* Icon */}
                  <motion.div
                    className="relative z-10"
                    animate={isActive ? { scale: 1.18, y: -1 } : { scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 26 }}
                  >
                    <Icon
                      style={{
                        width: 19,
                        height: 19,
                        color: isActive ? tab.accent : "rgba(255,255,255,0.65)",
                        strokeWidth: isActive ? 2.2 : 1.7,
                        filter: isActive
                          ? `drop-shadow(0 0 6px ${tab.glow}) drop-shadow(0 0 14px ${tab.glow}70)`
                          : undefined,
                        transition: "color 0.25s, filter 0.25s",
                      }}
                    />
                  </motion.div>

                  {/* Chinese brand name */}
                  <span
                    className="relative z-10 leading-none font-bold"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.05em",
                      color: isActive ? tab.accent : "rgba(255,255,255,0.72)",
                      textShadow: isActive ? `0 0 12px ${tab.glow}` : undefined,
                      transition: "color 0.25s, text-shadow 0.25s",
                    }}
                  >
                    {tab.zhLabel}
                  </span>

                  {/* English code */}
                  <span
                    className="relative z-10 leading-none"
                    style={{
                      fontSize: 7.5,
                      fontFamily: "monospace",
                      letterSpacing: "0.10em",
                      color: isActive ? `${tab.accent}cc` : "rgba(255,255,255,0.38)",
                      transition: "color 0.25s",
                    }}
                  >
                    {tab.enLabel}
                  </span>
                </motion.button>
              </Link>
            );
          })}
        </div>
      </LayoutGroup>
    </nav>
  );
}
