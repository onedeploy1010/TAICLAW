import type { CSSProperties } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { authWallet, getProfile, getProfileByRefCode } from "./lib/api";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThirdwebProvider, ConnectButton, useActiveAccount } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import { useThirdwebClient } from "@/hooks/use-thirdweb";
import { BSC_CHAIN } from "@/lib/contracts";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopSidebar } from "@/components/desktop-sidebar";
import LangSwitcher from "@/components/lang-switcher";
import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

import Dashboard from "@/pages/dashboard";
import Trade from "@/pages/trade";
import Vault from "@/pages/vault";
import StrategyPage from "@/pages/strategy";
import ProfilePage from "@/pages/profile";
import ProfileReferralPage from "@/pages/profile-referral";
import ProfileTierInfoPage from "@/pages/profile-tier-info";
import ProfileTransactionsPage from "@/pages/profile-transactions";
import ProfileNotificationsPage from "@/pages/profile-notifications";
import ProfileSettingsPage from "@/pages/profile-settings";
import ProfileNodesPage from "@/pages/profile-nodes";
import ProfileNodeEarningsPage from "@/pages/profile-node-earnings";
import ProfileSwapPage from "@/pages/profile-swap";
import ProfileMAPage from "@/pages/profile-ma";
import ProfileVaultPage from "@/pages/profile-vault";
import MarketPage from "@/pages/market";
import AdminApp from "@/admin/admin-app";
import ProviderApp from "@/provider/provider-app";
import CopyTradingPage from "@/pages/copy-trading";
import NotFound from "@/pages/not-found";

const wallets = [
  createWallet("pro.tokenpocket"),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
];

/**
 * Parse referral codes from URL.
 * Supports two formats:
 *   - New: /r/{refCode}/{placementCode}  (dual referral)
 *   - Legacy: ?ref={refCode}              (single referral, placement = referrer)
 */
function getRefCodesFromUrl(): { refCode: string | null; placementCode: string | null } {
  // New format: /r/{refCode}/{placementCode}
  const pathMatch = window.location.pathname.match(/^\/r\/([^/]+)(?:\/([^/]+))?/);
  if (pathMatch) {
    const ref = pathMatch[1];
    const placement = pathMatch[2] || ref; // default placement = referrer
    localStorage.setItem("taiclaw_ref_code", ref);
    localStorage.setItem("taiclaw_placement_code", placement);
    window.history.replaceState({}, "", "/");
    return { refCode: ref, placementCode: placement };
  }

  // Legacy format: ?ref={refCode}
  const urlParams = new URLSearchParams(window.location.search);
  const urlRef = urlParams.get("ref");
  if (urlRef) {
    localStorage.setItem("taiclaw_ref_code", urlRef);
    localStorage.setItem("taiclaw_placement_code", urlRef);
    urlParams.delete("ref");
    const newUrl = urlParams.toString()
      ? `${window.location.pathname}?${urlParams.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
    return { refCode: urlRef, placementCode: urlRef };
  }

  return {
    refCode: localStorage.getItem("taiclaw_ref_code"),
    placementCode: localStorage.getItem("taiclaw_placement_code"),
  };
}

function WalletSync() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const account = useActiveAccount();
  const refCodesRef = useRef<{ refCode: string | null; placementCode: string | null }>({ refCode: null, placementCode: null });
  const [showRefDialog, setShowRefDialog] = useState(false);
  const [showRefConfirm, setShowRefConfirm] = useState(false);
  const [refInput, setRefInput] = useState("");
  const [placementInput, setPlacementInput] = useState("");
  const [refError, setRefError] = useState("");
  const [refLoading, setRefLoading] = useState(false);
  const [referrerWallet, setReferrerWallet] = useState<string | null>(null);
  const [placementWallet, setPlacementWallet] = useState<string | null>(null);

  useEffect(() => {
    refCodesRef.current = getRefCodesFromUrl();
  }, []);

  const doAuth = useCallback(async (address: string, refCode?: string, placementCode?: string) => {
    const result = await authWallet(address, refCode, placementCode);
    if (result?.error === "REFERRAL_REQUIRED") {
      setShowRefDialog(true);
      return false;
    }
    if (refCode) {
      localStorage.removeItem("taiclaw_ref_code");
      localStorage.removeItem("taiclaw_placement_code");
    }
    return true;
  }, []);

  useEffect(() => {
    if (!account?.address) return;
    const codes = refCodesRef.current;
    const refCode = codes.refCode || localStorage.getItem("taiclaw_ref_code");
    const placementCode = codes.placementCode || localStorage.getItem("taiclaw_placement_code");

    (async () => {
      try {
        const profile = await getProfile(account.address);
        if (!profile && refCode) {
          // New user with referral code — look up referrer/placement and show confirmation
          try {
            const referrer = await getProfileByRefCode(refCode);
            if (referrer?.walletAddress) setReferrerWallet(referrer.walletAddress);
          } catch {}
          if (placementCode && placementCode !== refCode) {
            try {
              const placement = await getProfileByRefCode(placementCode);
              if (placement?.walletAddress) setPlacementWallet(placement.walletAddress);
            } catch {}
          }
          setRefInput(refCode);
          setPlacementInput(placementCode || refCode);
          setShowRefConfirm(true);
        } else {
          await doAuth(account.address, refCode || undefined, placementCode || undefined);
        }
      } catch {
        await doAuth(account.address, refCode || undefined, placementCode || undefined);
      }
    })();
  }, [account?.address, doAuth]);

  const handleRefConfirm = async () => {
    if (!refInput.trim() || !account?.address) return;
    setRefError("");
    setRefLoading(true);
    try {
      const placement = placementInput.trim() || refInput.trim();
      const ok = await doAuth(account.address, refInput.trim(), placement);
      if (ok) {
        setShowRefConfirm(false);
        setRefInput(""); setPlacementInput("");
        toast({ title: t("common.registerSuccess"), description: t("common.registerSuccessDesc") });
      } else {
        setRefError(t("profile.invalidRefCode"));
      }
    } catch {
      setRefError(t("profile.invalidRefCode"));
    } finally {
      setRefLoading(false);
    }
  };

  const handleRefSubmit = async () => {
    if (!refInput.trim() || !account?.address) return;
    setRefError("");
    setRefLoading(true);
    try {
      const placement = placementInput.trim() || refInput.trim();
      const ok = await doAuth(account.address, refInput.trim(), placement);
      if (ok) {
        setShowRefDialog(false);
        setRefInput(""); setPlacementInput("");
        toast({ title: t("common.registerSuccess"), description: t("common.registerSuccessDesc") });
      } else {
        setRefError(t("profile.invalidRefCode"));
      }
    } catch {
      setRefError(t("profile.invalidRefCode"));
    } finally {
      setRefLoading(false);
    }
  };

  const DIALOG_STYLE: CSSProperties = {
    background: "linear-gradient(160deg, #0f172a 0%, #0c1628 100%)",
    border: "1px solid rgba(59,130,246,0.25)",
    borderRadius: 20,
    boxShadow: "0 25px 60px rgba(0,0,0,0.8), 0 0 40px rgba(59,130,246,0.08)",
  };
  const ICON_STYLE: CSSProperties = {
    background: "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)",
    boxShadow: "0 4px 15px rgba(59,130,246,0.4)",
  };
  const BTN_STYLE: CSSProperties = {
    background: "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)",
    boxShadow: "0 4px 15px rgba(59,130,246,0.35)",
  };
  const INPUT_NORMAL: CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(59,130,246,0.2)",
  };
  const INPUT_ERROR: CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid #ef4444",
  };

  return (
    <>
    {/* ── 强制推荐码弹窗（新用户无推荐链接）─────────────────── */}
    <Dialog open={showRefDialog} onOpenChange={() => {}}>
      <DialogContent
        className="w-[calc(100vw-24px)] max-w-[400px] p-0 overflow-hidden [&>button:last-child]:hidden"
        style={DIALOG_STYLE}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{t("profile.enterRefCode")}</DialogTitle>
        <DialogDescription className="sr-only">{t("profile.refCodeRequired")}</DialogDescription>

        {/* 顶部蓝色渐变条 */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #1d4ed8, #3b82f6, #60a5fa)" }} />

        <div className="px-6 pt-6 pb-2 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={ICON_STYLE}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
              <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
          </div>
          <h3 className="text-base font-bold text-white">{t("profile.enterRefCode")}</h3>
          <p className="text-xs text-white/40 mt-1 leading-relaxed">{t("profile.refCodeRequired")}</p>
          {/* 必填提示 */}
          <div className="mt-3 rounded-lg px-3 py-2 text-xs font-medium" style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", color: "#93c5fd" }}>
            ⚠ {t("profile.refCodeMandatory", "注册必须填写推荐码，无推荐码无法使用本平台")}
          </div>
        </div>

        <div className="px-6 pb-6 pt-3 space-y-3">
          <div>
            <p className="text-[11px] text-white/50 mb-1.5 font-medium uppercase tracking-wide">{t("profile.sponsorCode", "推荐人码")}</p>
            <input
              type="text"
              value={refInput}
              onChange={(e) => { setRefInput(e.target.value); setRefError(""); }}
              placeholder={t("profile.refCodePlaceholder")}
              className="w-full h-11 rounded-xl px-4 text-sm text-white placeholder:text-white/25 outline-none font-mono tracking-widest"
              style={refError ? INPUT_ERROR : INPUT_NORMAL}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleRefSubmit()}
            />
          </div>
          <div>
            <p className="text-[11px] text-white/50 mb-1.5 font-medium uppercase tracking-wide">{t("profile.placementCode", "安置码")}<span className="text-white/25 ml-1 normal-case">({t("common.optional","可选")})</span></p>
            <input
              type="text"
              value={placementInput}
              onChange={(e) => { setPlacementInput(e.target.value); setRefError(""); }}
              placeholder={t("profile.placementCodePlaceholder", "默认与推荐码相同")}
              className="w-full h-11 rounded-xl px-4 text-sm text-white placeholder:text-white/25 outline-none font-mono"
              style={INPUT_NORMAL}
              onKeyDown={(e) => e.key === "Enter" && handleRefSubmit()}
            />
          </div>
          {refError && <p className="text-xs text-red-400 flex items-center gap-1"><span>✕</span>{refError}</p>}
          <button
            onClick={handleRefSubmit}
            disabled={refLoading || !refInput.trim()}
            className="w-full h-11 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.97] disabled:opacity-40"
            style={BTN_STYLE}
          >
            {refLoading ? t("common.processing") : t("common.confirm")}
          </button>
        </div>
      </DialogContent>
    </Dialog>

    {/* ── 推荐链接确认弹窗（已有推荐码，新用户确认）────────── */}
    <Dialog open={showRefConfirm} onOpenChange={() => {}}>
      <DialogContent
        className="w-[calc(100vw-24px)] max-w-[400px] p-0 overflow-hidden [&>button:last-child]:hidden"
        style={DIALOG_STYLE}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{t("profile.confirmRefCode")}</DialogTitle>
        <DialogDescription className="sr-only">{t("profile.confirmRefCodeDesc")}</DialogDescription>

        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #1d4ed8, #3b82f6, #60a5fa)" }} />

        <div className="px-6 pt-6 pb-2 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={ICON_STYLE}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h3 className="text-base font-bold text-white">{t("profile.confirmRefCode")}</h3>
          <p className="text-xs text-white/40 mt-1">{t("profile.confirmRefCodeDesc")}</p>
        </div>

        <div className="px-6 pb-6 pt-3 space-y-2.5">
          {referrerWallet && (
            <div className="rounded-xl px-4 py-2.5" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
              <p className="text-[10px] text-white/40 mb-0.5 uppercase tracking-wide">{t("profile.sponsorLabel", "推荐人")}</p>
              <p className="text-xs text-blue-400 font-mono truncate">{referrerWallet}</p>
            </div>
          )}
          {placementWallet && placementWallet !== referrerWallet && (
            <div className="rounded-xl px-4 py-2.5" style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.12)" }}>
              <p className="text-[10px] text-white/40 mb-0.5 uppercase tracking-wide">{t("profile.placementLabel", "安置人")}</p>
              <p className="text-xs text-blue-300 font-mono truncate">{placementWallet}</p>
            </div>
          )}
          <div>
            <p className="text-[11px] text-white/50 mb-1.5 font-medium uppercase tracking-wide">{t("profile.sponsorCode", "推荐码")}</p>
            <input
              type="text"
              value={refInput}
              onChange={(e) => { setRefInput(e.target.value); setRefError(""); setReferrerWallet(null); }}
              placeholder={t("profile.refCodePlaceholder")}
              className="w-full h-11 rounded-xl px-4 text-sm text-white placeholder:text-white/25 outline-none text-center font-mono tracking-widest"
              style={refError ? INPUT_ERROR : INPUT_NORMAL}
              autoFocus
            />
          </div>
          <div>
            <p className="text-[11px] text-white/50 mb-1.5 font-medium uppercase tracking-wide">{t("profile.placementCode", "安置码")}<span className="text-white/25 ml-1 normal-case">({t("common.optional","可选")})</span></p>
            <input
              type="text"
              value={placementInput}
              onChange={(e) => { setPlacementInput(e.target.value); setRefError(""); setPlacementWallet(null); }}
              placeholder={t("profile.placementCodePlaceholder", "默认与推荐码相同")}
              className="w-full h-11 rounded-xl px-4 text-sm text-white placeholder:text-white/25 outline-none text-center font-mono"
              style={INPUT_NORMAL}
              onKeyDown={(e) => e.key === "Enter" && handleRefConfirm()}
            />
          </div>
          {refError && <p className="text-xs text-red-400 flex items-center gap-1"><span>✕</span>{refError}</p>}
          <button
            onClick={handleRefConfirm}
            disabled={refLoading || !refInput.trim()}
            className="w-full h-11 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.97] disabled:opacity-40 mt-1"
            style={BTN_STYLE}
          >
            {refLoading ? t("common.processing") : t("profile.confirmAndRegister")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

function Header() {
  const { client, isLoading } = useThirdwebClient();
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 lg:px-8 py-2.5 lg:py-3 border-b border-border/40 bg-background/90 backdrop-blur-xl">
      <Link href="/" className="flex items-center cursor-pointer shrink-0" data-testid="link-logo-home">
        {/* QA Logo mark */}
        <div className="h-8 w-8 lg:h-9 lg:w-9 rounded-xl flex items-center justify-center shrink-0 font-display font-black text-sm lg:text-base tracking-tight select-none"
          style={{
            background: "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 50%, #60a5fa 100%)",
            boxShadow: "0 0 16px rgba(59,130,246,0.45), inset 0 1px 0 rgba(255,255,255,0.2)",
            color: "#fff",
            letterSpacing: "-0.02em",
          }}>
          QA
        </div>
        <span className="font-display font-bold ml-2 leading-tight flex-col hidden sm:flex">
          <span className="text-foreground text-xs lg:text-sm tracking-[0.2em]">QA</span>
          <span className="text-primary text-[0.55rem] lg:text-[0.6rem] tracking-[0.35em]">PROTOCOL</span>
        </span>
      </Link>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {isLoading ? (
          <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
        ) : client ? (
          <ConnectButton
            client={client}
            chain={BSC_CHAIN}
            wallets={wallets}
            connectButton={{
              label: t("common.connect"),
              style: {
                background: "linear-gradient(135deg, hsl(43, 74%, 58%), hsl(38, 80%, 44%))",
                color: "#0a0704",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "700",
                height: "36px",
                padding: "0 14px",
                border: "none",
                boxShadow: "0 0 12px rgba(212, 168, 50, 0.35)",
                whiteSpace: "nowrap",
              },
            }}
            detailsButton={{
              style: {
                background: "hsl(170, 18%, 10%)",
                color: "hsl(165, 15%, 93%)",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "500",
                height: "36px",
                padding: "0 10px",
                border: "1px solid rgba(212, 168, 50, 0.18)",
                boxShadow: "0 0 8px rgba(212, 168, 50, 0.05)",
                maxWidth: "140px",
              },
            }}
            theme="dark"
            showThirdwebBranding={false}
          />
        ) : (
          /* Fallback shown when ThirdWeb client cannot initialize */
          <button
            onClick={() => window.open("https://thirdweb.com/dashboard", "_blank")}
            title="Configure VITE_THIRDWEB_CLIENT_ID to enable wallet connection"
            style={{
              background: "linear-gradient(135deg, hsl(43, 74%, 58%), hsl(38, 80%, 44%))",
              color: "#0a0704",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "700",
              height: "36px",
              padding: "0 14px",
              border: "none",
              boxShadow: "0 0 12px rgba(212, 168, 50, 0.35)",
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
            data-testid="button-connect-fallback"
          >
            {t("common.connect", "Connect")}
          </button>
        )}
        <LangSwitcher />
      </div>
    </header>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/r/:ref/:placement?" component={Dashboard} />
      <Route path="/trade" component={Trade} />
      <Route path="/vault" component={Vault} />
      <Route path="/strategy" component={StrategyPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/profile/referral/info" component={ProfileTierInfoPage} />
      <Route path="/profile/referral" component={ProfileReferralPage} />
      <Route path="/profile/transactions" component={ProfileTransactionsPage} />
      <Route path="/profile/notifications" component={ProfileNotificationsPage} />
      <Route path="/profile/settings" component={ProfileSettingsPage} />
      <Route path="/profile/nodes" component={ProfileNodesPage} />
      <Route path="/profile/swap" component={ProfileSwapPage} />
      <Route path="/profile/ma" component={ProfileMAPage} />
      <Route path="/profile/vault" component={ProfileVaultPage} />
      <Route path="/copy-trading" component={CopyTradingPage} />
      <Route path="/profile/nodes/earnings" component={ProfileNodeEarningsPage} />
      <Route path="/market" component={MarketPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppMain() {
  return (
    <main className="flex-1 mx-auto max-w-lg lg:max-w-4xl w-full">
      <Router />
    </main>
  );
}

function MainApp() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <div className="flex">
        <DesktopSidebar />
        <AppMain />
      </div>
      <BottomNav />
      <WalletSync />
    </div>
  );
}

function RootRouter() {
  const [location] = useLocation();

  if (location.startsWith("/admin")) {
    return <AdminApp />;
  }

  if (location.startsWith("/provider")) {
    return <ProviderApp />;
  }

  return <MainApp />;
}

function App() {
  return (
    <ThirdwebProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RootRouter />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThirdwebProvider>
  );
}

export default App;
