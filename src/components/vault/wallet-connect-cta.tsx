import { ConnectButton } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import { useThirdwebClient } from "@/hooks/use-thirdweb";
import { BSC_CHAIN } from "@/lib/contracts";
import { useTranslation } from "react-i18next";

const WALLETS = [
  createWallet("pro.tokenpocket"),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
];

interface WalletConnectCtaProps {
  accentColor?: string;
  descKey?: string;
  descDefault?: string;
}

export function WalletConnectCta({
  accentColor = "rgba(212,168,50,0.9)",
  descKey = "common.connectWalletFirst",
  descDefault = "Connect your wallet to use this feature",
}: WalletConnectCtaProps) {
  const { t } = useTranslation();
  const { client, isLoading } = useThirdwebClient();

  if (isLoading || !client) return null;

  return (
    <div
      className="flex flex-col items-center gap-3 rounded-xl py-6 px-4 my-2"
      style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}20` }}
    >
      <p className="text-xs text-muted-foreground text-center">
        {t(descKey, descDefault)}
      </p>
      <ConnectButton
        client={client}
        chain={BSC_CHAIN}
        wallets={WALLETS}
        connectButton={{
          label: t("common.connectWallet", "Connect Wallet"),
          style: {
            background: `linear-gradient(135deg, ${accentColor}, rgba(180,130,30,0.9))`,
            color: "#0a0704",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: "700",
            height: "38px",
            padding: "0 20px",
            border: "none",
            boxShadow: `0 0 14px ${accentColor}40`,
          },
        }}
        detailsButton={{
          style: {
            background: "hsl(170, 18%, 10%)",
            color: "hsl(165, 15%, 93%)",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: "500",
            height: "38px",
            padding: "0 14px",
            border: `1px solid ${accentColor}20`,
          },
        }}
        theme="dark"
        showThirdwebBranding={false}
      />
    </div>
  );
}
