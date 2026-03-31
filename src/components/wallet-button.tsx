import { ConnectButton } from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { useThirdwebClient } from "@/hooks/use-thirdweb";

const wallets = [
  inAppWallet(),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("me.rainbow"),
  createWallet("io.rabby"),
];

export function WalletButton() {
  const { client, isLoading } = useThirdwebClient();

  if (isLoading || !client) {
    return (
      <div className="h-9 w-28 animate-pulse rounded-md bg-muted" data-testid="wallet-loading" />
    );
  }

  return (
    <ConnectButton
      client={client}
      wallets={wallets}
      connectButton={{
        label: "Connect",
        style: {
          background: "hsl(142, 72%, 45%)",
          color: "hsl(150, 20%, 5%)",
          borderRadius: "6px",
          fontSize: "13px",
          fontWeight: "600",
          height: "36px",
          padding: "0 16px",
          border: "none",
        },
      }}
      detailsButton={{
        style: {
          background: "hsl(150, 8%, 14%)",
          color: "hsl(150, 5%, 95%)",
          borderRadius: "6px",
          fontSize: "13px",
          fontWeight: "500",
          height: "36px",
          padding: "0 12px",
          border: "1px solid hsl(150, 8%, 20%)",
        },
      }}
      theme="dark"
      data-testid="wallet-connect-button"
    />
  );
}
