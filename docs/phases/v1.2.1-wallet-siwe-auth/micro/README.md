# 작업 티켓 - v1.2.1

## 전체 현황

| # | Step | 난이도 | 롤백 | Scope | FP/FN | 개발 | 완료일 |
|---|------|--------|------|-------|-------|------|--------|
| 01 | AppState 확장 (auth + Stage 재배치) | 🟡 | ✅ | apps/web/src/state | ✅ | ⏳ | - |
| 02 | useSiweAuth 훅 + hq-api factory | 🟠 | ✅ | apps/web/src/domains/auth, lib/hq-api | ✅ | ⏳ | - |
| 03 | ConnectWallet 분리 + Providers wiring | 🟠 | ✅ | apps/web/src/domains/wallet, components/providers, app/page | ✅ | ⏳ | - |
| 04 | SiteHeader WalletBadge | 🟡 | ✅ | apps/web/src/components/site-header, ui | ✅ | ⏳ | - |
| 05 | HQ 컨테이너 정리 (guard 분기 삭제 + env + compose + 재기동) | 🟠 | ✅ | HQ worktree apps/server | ✅ | ⏳ | - |
| 06 | 통합 검증 (typecheck/build + 시연 노트) | 🟢 | ✅ | (검증) | ✅ | ⏳ | - |

## 의존성

```
01 (AppState)
 ├─► 02 (hook + hq-api)
 │    ├─► 03 (ConnectWallet 분리 + Providers wiring)
 │    │    └─► 04 (SiteHeader badge)
 │    │         └─► 06 (검증)
 │    └─────────► 06
 └─────────────────► 06
05 (HQ container) ──► 06
```

02-03-04 는 web side, 05 는 HQ side — 병렬 가능.
05 가 먼저 끝나면 web 변경 후 곧장 통합 시연 가능.

## 커버리지 매트릭스

### PRD 목표 → 티켓
| PRD 목표 | 관련 티켓 | 커버 |
|----------|----------|------|
| wagmi address == HQ session owner | 02, 03, 05 | ✅ |
| Bearer dev 제거 | 02, 05 | ✅ |
| Stage 순서 재배치 | 01 | ✅ |
| SiteHeader wallet badge | 04 | ✅ |
| ConnectWallet 모달화 | 03 | ✅ |
| HQ dev-bypass 컨테이너 제거 | 05 | ✅ |
| 토큰 만료 시 재인증 모달 | 02, 03 | ✅ |

### DoD → 티켓
| DoD | 티켓 |
|-----|------|
| F1 hq-api factory | 02 |
| F2 useSiweAuth | 02 |
| F3 AppState auth | 01 |
| F4 Stage 순서 | 01 |
| F5 stage guard | 01 |
| F6 WalletBadge | 04 |
| F7 ConnectWallet 분리 | 03 |
| F8 Bearer attach | 02 |
| F9 owner 일치 | 02+05 통합 |
| F10 guard 분기 삭제 | 05 |
| F11 .env.local | 05 |
| F12 system prompt mount | 05 |
| F13 만료 modal | 02+03 |
| F14 account switch | 02 |
| F15 disconnect | 02+04 |
| N1~N7 비기능 | 06 |
| E1~E12 엣지 | 06 (수동 시연) |

### 설계 결정 → 티켓
| 결정 | 티켓 |
|------|------|
| A2 plain challenge personal_sign | 02 |
| B2 in-memory token | 01, 02 |
| C2 stage 순서 재배치 | 01 |
| D2 Panel/Stage/Modal 분리 | 03 |
| factory hq-api | 02 |
