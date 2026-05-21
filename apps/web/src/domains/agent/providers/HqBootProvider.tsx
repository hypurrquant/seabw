"use client";

import { ReactNode, useEffect } from "react";
import { setHttpBaseUrl } from "@hq/core/lib/http";
import type { ExecutionRequest } from "@hq/core/lib/types";
import type { PlatformExecuteResult } from "@hq/core/defi/pipeline/types";
import { initPlatformDeps } from "@hq/react/platform";
import { hydrateTokenConfig } from "@hq/react/token";
import { hydratePoolConfig } from "@hq/react/defi/lp/pool";
import {
  sendTransaction,
  signMessage as signMessageAction,
  waitForTransactionReceipt,
} from "wagmi/actions";
import { getWagmiConfig } from "@/lib/wagmi";

let __hqPlatformInitialized = false;

const HQ_ORIGIN = process.env.NEXT_PUBLIC_HQ_ORIGIN ?? "http://localhost:3003";

async function execute(
  request: ExecutionRequest,
  _description: string | null,
): Promise<PlatformExecuteResult> {
  const config = getWagmiConfig();
  const hash = await sendTransaction(config, {
    chainId: request.chainId,
    to: request.call.to,
    data: request.call.data,
    value: request.call.value,
  });
  // HQ executeResolvedPipeline calls getTransactionReceipt({hash}) immediately
  // after this returns — no polling. We must wait for the receipt here so that
  // call doesn't throw TransactionReceiptNotFoundError.
  await waitForTransactionReceipt(config, {
    hash,
    chainId: request.chainId,
    timeout: 90_000,
  });
  return { hash };
}

async function signMessage(message: string): Promise<`0x${string}`> {
  return signMessageAction(getWagmiConfig(), { message });
}

export function HqBootProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (__hqPlatformInitialized) return;
    __hqPlatformInitialized = true;

    setHttpBaseUrl(HQ_ORIGIN);
    initPlatformDeps({
      execute,
      signMessage,
      storage: window.sessionStorage,
      showToast: (toast) => {
        console.info("[hq]", toast.type, toast.title, toast.message);
      },
      onBeforeUnload: (callback) => {
        const handler = () => callback();
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
      },
      getSignDeps: () => null,
    });

    // Hydrate token + pool config in parallel. Without these, useTokenConfigStore
    // and usePoolConfigStore stay empty; every balance/pool scan returns 0.
    void hydrateTokenConfig()
      .then(() => console.info("[hq-boot] token config hydrated"))
      .catch((err) => console.warn("[hq-boot] hydrateTokenConfig failed", err));
    void hydratePoolConfig()
      .then(() => console.info("[hq-boot] pool config hydrated"))
      .catch((err) => console.warn("[hq-boot] hydratePoolConfig failed", err));
  }, []);

  return <>{children}</>;
}
