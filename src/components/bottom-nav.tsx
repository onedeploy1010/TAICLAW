import { useLocation, Link } from "wouter";
import { Home, BarChart3, Brain, User } from "lucide-react";

const tabs = [
  { path: "/", icon: Home, id: "home" },
  { path: "/trade", icon: BarChart3, id: "trade" },
  {
    path: "/vault",
    id: "vault",
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
        <circle cx="12" cy="8" r="5" />
        <circle cx="12" cy="8" r="2" />
        <path d="M12 13v3" />
        <path d="M8 21h8" />
        <path d="M10 18h4" />
      </svg>
    ),
  },
  { path: "/strategy", icon: Brain, id: "strategy" },
  { path: "/profile", icon: User, id: "profile" },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      data-testid="bottom-nav"
    >
      <div
        className="floating-nav pointer-events-auto flex items-center mx-4 mb-3 sm:mb-4 px-2 sm:px-3 py-2 sm:py-2.5 gap-1 sm:gap-2 w-[calc(100%-2rem)] max-w-md"
      >
        {tabs.map((tab) => {
          const isActive = tab.path === "/" ? location === "/" : location.startsWith(tab.path);
          const Icon = tab.icon;
          return (
            <Link key={tab.path} href={tab.path} className="flex-1 flex justify-center">
              <button
                className={`floating-nav-item relative flex items-center justify-center rounded-2xl transition-all duration-300 ${
                  isActive ? "floating-nav-active" : ""
                }`}
                style={{
                  width: isActive ? 52 : 44,
                  height: isActive ? 44 : 40,
                }}
                data-testid={`nav-${tab.id}`}
              >
                <Icon
                  className={`transition-all duration-300 ${
                    isActive
                      ? "h-[22px] w-[22px] text-[#00e7a0]"
                      : "h-5 w-5 text-[rgba(180,195,190,0.5)]"
                  }`}
                  style={isActive ? { filter: "drop-shadow(0 0 8px rgba(0,231,160,0.5))" } : undefined}
                />
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
