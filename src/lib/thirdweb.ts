import { createThirdwebClient } from "thirdweb";

let _client: ReturnType<typeof createThirdwebClient> | null = null;

export function getThirdwebClient() {
  if (_client) return _client;
  const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID || "";
  if (!clientId) throw new Error("VITE_THIRDWEB_CLIENT_ID is not set");
  _client = createThirdwebClient({ clientId });
  return _client;
}

export function createStaticClient(clientId: string) {
  _client = createThirdwebClient({ clientId });
  return _client;
}
