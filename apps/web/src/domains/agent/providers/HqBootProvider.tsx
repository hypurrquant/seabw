"use client";

import { ReactNode, useEffect } from "react";
import { setHttpBaseUrl } from "@hq/core/lib/http";
import type { ExecutionRequest } from "@hq/core/lib/types";
import type { PlatformExecuteResult } from "@hq/core/defi/pipeline/types";
import { initPlatformDeps } from "@hq/react/platform";
import { sendTransaction, signMessage as signMessageAction } from "wagmi/actions";
import { getWagmiConfig } from "@/lib/wagmi";

let __hqPlatformInitialized = false;

const HQ_ORIGIN = process.env.NEXT_PUBLIC_HQ_ORIGIN ?? "http://localhost:3003";

async function execute(
  request: ExecutionRequest,
  _description: string | null,
): Promise<PlatformExecuteResult> {
  const hash = await sendTransaction(getWagmiConfig(), {
    chainId: request.chainId,
    to: request.call.to,
    data: request.call.data,
    value: request.call.value,
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
  }, []);

  return <>{children}</>;
}
