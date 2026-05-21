"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/state/app-state";
import { Chat } from "@/domains/chat/chat";
import { PositionsCurtain } from "@/domains/positions/positions-curtain";
import { usePrefetchUserData } from "@/domains/positions/use-prefetch-user-data";
import { TierResultView } from "@/domains/survey/tier-result";
import { Button, Card, Pill } from "@/components/ui";
import { decodeAnswers } from "@/lib/answers-url";
import { deriveTier } from "@/domains/survey/lib";

function ChatRoute() {
  const router = useRouter();
  const params = useSearchParams();
  const { state, dispatch } = useApp();
  const hydratedRef = useRef(false);

  const encoded = params.get("a");
  const answers = useMemo(
    () => (encoded ? decodeAnswers(encoded) : null),
    [encoded],
  );

  const owner =
    state.auth.status === "authed" ? state.auth.ownerAddress : undefined;
  const prefetch = usePrefetchUserData(owner);

  useEffect(() => {
    console.info("[chat-route] mount/update", {
      hasEncoded: !!encoded,
      encodedLen: encoded?.length ?? 0,
      decodeOK: !!answers,
      rehydrated: state.rehydrated,
      authStatus: state.auth.status,
      ownerAddress: state.auth.ownerAddress,
      hasTier: !!state.tier,
      prefetchStatus: prefetch.status,
      hydrated: hydratedRef.current,
    });

    if (!state.rehydrated) {
      console.info("[chat-route] waiting for AppState rehydrate");
      return;
    }
    if (!answers) {
      console.warn(
        "[chat-route] redirect → / : answers decode failed (encoded? ",
        !!encoded,
        ")",
      );
      router.replace("/");
      return;
    }
    if (state.auth.status !== "authed") {
      console.warn(
        "[chat-route] redirect → / : auth not authed (status=",
        state.auth.status,
        ")",
      );
      router.replace("/");
      return;
    }
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const tier = deriveTier(answers);
    console.info("[chat-route] hydrate", { tier: tier.tier, rawScore: tier.rawScore });
    dispatch({ type: "SET_ANSWERS", answers });
    dispatch({ type: "SET_TIER", tier });
  }, [answers, encoded, state.rehydrated, state.auth.status, state.auth.ownerAddress, state.tier, prefetch.status, dispatch, router]);

  if (!state.rehydrated || !answers || state.auth.status !== "authed" || !state.tier) {
    return null;
  }

  return (
    <div className="flex min-h-[calc(100dvh-2.5rem)] flex-col">
      <PositionsCurtain />
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-2">
        <aside className="overflow-y-auto border-b lg:border-b-0 lg:border-r border-[color:var(--color-border)]">
          <TierResultView readOnly />
        </aside>
        <section className="flex h-full flex-col overflow-hidden">
          {prefetch.status === "ready" ? (
            <Chat />
          ) : prefetch.status === "error" ? (
            <main className="mx-auto flex h-full w-full max-w-5xl flex-col items-start gap-3 px-6 py-6">
              <Pill>DefiPilot Chat</Pill>
              <Card className="border-[color:var(--color-danger)]/40">
                <p className="text-sm">지갑 데이터 로드에 실패했어요.</p>
                <p className="mt-1 text-xs text-[color:var(--color-fg-muted)]">
                  {prefetch.error}
                </p>
                <Button className="mt-3" onClick={prefetch.retry}>
                  다시 시도
                </Button>
              </Card>
            </main>
          ) : (
            <main className="mx-auto flex h-full w-full max-w-5xl flex-col items-start gap-3 px-6 py-6">
              <Pill>DefiPilot Chat</Pill>
              <Card>
                <div className="flex items-center gap-3">
                  <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-[color:var(--color-accent)]" />
                  <p className="text-sm">지갑 분석 중이에요… (잔액 + LP 포지션 로드)</p>
                </div>
              </Card>
            </main>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatRoute />
    </Suspense>
  );
}
