import { useState, useEffect } from "react";
import { createThirdwebClient } from "thirdweb";

let cachedClient: ReturnType<typeof createThirdwebClient> | null = null;

export function useThirdwebClient() {
  const [client, setClient] = useState<ReturnType<typeof createThirdwebClient> | null>(cachedClient);
  const [isLoading, setIsLoading] = useState(!cachedClient);

  useEffect(() => {
    if (cachedClient) {
      setClient(cachedClient);
      setIsLoading(false);
      return;
    }

    try {
      const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID || "";
      if (clientId) {
        const c = createThirdwebClient({ clientId });
        cachedClient = c;
        setClient(c);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { client, isLoading };
}
