# DefiPilot

**리테일 투자자를 위한 개인화 DeFi 어드바이저 — KOFIA 설문에서 온체인 LP까지, 한 번의 대화로**

[기능](#주요-기능) • [아키텍처](#아키텍처) • [데모](#데모-시나리오) • [기술 스택](#기술-스택) • [시작하기](#시작하기)

---

## 문제

리테일 사용자는 스테이블코인(USDC, USDT, DAI)과 네이티브 자산(ETH, HYPE)을 보유하고 있지만, 이를 온체인에서 생산적으로 굴리려면 둘 중 하나입니다:

- 백서 읽고, 30+ 프로토콜 비교하고, concentrated liquidity tick 수학까지 익히거나
- 본인의 실제 리스크 성향을 무시한 "이자" 상품을 맹목적으로 믿거나

두 경로 모두 똑같은 리테일 사용자를 실패시킵니다. **규제 등급의 투자자 성향 진단**을 **사용자가 자기 지갑으로 직접 서명하는 실행 가능한 온체인 플랜**으로 잇는 어드바이저가 존재하지 않습니다.

## 솔루션

**DefiPilot** 은 리테일 → DeFi 여정을 한 번의 대화로 끝내는 개인화 어드바이저입니다:

- **📋 투자자 성향 진단** — KOFIA(한국금융투자협회) 프레임워크 기반 10문항 설문으로 5단계 tier 도출: `preservation · conservative · balanced · aggressive · degen`. 각 tier 는 하드 바운드(최대 레버리지, 최대 LP cap, 최대 bridge 개수 등)를 가집니다.
- **💬 AI 어드바이저** — 성향 정보를 미리 주입받은 LLM 이 한국어/영어 평어체로 답변, 모든 제안에서 사용자의 tier 를 인용하고, tier 한계를 깨는 요청은 거절합니다.
- **🧰 브라우저 네이티브 Tool 루프** — 어드바이저는 사용자의 *브라우저 자체*에 손을 뻗습니다 — 지갑, 잔액, 가격, 풀 데이터, 서명 요청. 모두 타입 안전한 함수 호출을 통해서요. AI 가 키를 들고 있지 않습니다. 브라우저가 키를 들고 있고, AI 는 단지 필요한 것을 *요청*할 뿐입니다.
- **🪪 LP 추천 카드** — 모든 LP 추천은 정확히 3장의 카드로 렌더됩니다. 원본 트랜잭션 JSON 노출이나 "실행할까요?" 같은 중간 확인은 없습니다. 사용자가 원하는 카드를 클릭합니다.
- **🖋️ 사용자 서명 실행** — 사용자가 카드를 수락하면 지갑이 자동으로 HyperEVM(체인 999) 으로 전환되고, 사용자가 본인 지갑에서 각 단계를 서명합니다. DefiPilot 은 자산을 보관하지 않습니다.

---

## 주요 기능

### 1. KOFIA 등급 투자자 성향 진단

투자기간, 자산 비중, DeFi 경험, 손실 감내, 리스크 리터러시, 파생 경험, 연령대, 취약 소비자 자기진단을 다루는 10문항 설문. 결과:

- `tier` ∈ `{preservation, conservative, balanced, aggressive, degen}`
- `rawScore`, 하드 바운드 (`maxLeverage`, `maxLpCapUsd`, `maxBridges`, `maxProtocols`)
- 취약 소비자 자동 하향, `degen` 기준 미충족 시 자동 `aggressive` 강등

tier 와 답변은 AI 세션에 구조화된 profile 로 **그리고** 첫 user message 마크다운 블록으로 — 의도적으로 중복 — 주입되어, 모델이 사용자를 "잊을 수" 없게 만듭니다.

### 2. 브라우저 네이티브 Tool 루프 *(핵심 아키텍처 아이디어)*

DefiPilot 은 일반적인 server-side tool 패턴을 뒤집습니다. 대부분의 LLM 제품은 tool 을 서버에서 실행합니다 — LLM 이 서버에게 "잔액 가져와", "트랜잭션 서명해" 라고 요청하면 서버가 키, RPC 연결, 사용자 세션을 들고 있습니다. DefiPilot 은 정반대입니다. **tool 이 사용자의 브라우저 안에 살고, AI 가 브라우저를 호출합니다.**

브라우저는 타입 안전한 함수들이 가득한 런타임으로 취급됩니다. 각 함수는 다음 중 하나를 합니다:

- **이 특정 사용자의 온체인 상태를 읽음** — 지갑 상태, 네이티브 잔액, 토큰 잔액, 기존 LP 포지션
- **사용자가 보유한 자산에 한정된 시장 데이터 조회** — 후보 풀, 풀 상세, 가격, tick 데이터
- **순수 계산** — 최적 range 도출, 입금량 양면 분할, swap 라우팅 수학
- **지갑 변경 요청** — 체인 전환 요청, 서명 요청

모든 함수는 정적 타입 + 런타임 스키마를 가지므로, AI 의 호출은 브라우저에 닿기 *전에* 검증됩니다. 스키마 위반은 부수 효과 없이 거절됩니다.

상호작용 루프:

```
┌──────────────────────────┐
│  AI 가 응답을 스트림    │
└────────────┬─────────────┘
             │  emits  tool_call { name, args }
             ▼
┌──────────────────────────────────────────────────────────┐
│  Browser                                                 │
│  1. 함수의 스키마로 args 검증                            │
│  2. 브라우저 탭 안에서 함수 실행                         │
│     (사용자 지갑 읽기, RPC 조회, 계산 수행, ...)         │
│  3. 반환값을 tool_result 로 감쌈                         │
└────────────┬─────────────────────────────────────────────┘
             │  tool_result { ok, data | error }
             ▼
┌──────────────────────────┐
│  AI 가 스트림 재개      │  → 추가 tool 호출 또는 답변 마무리
└──────────────────────────┘
```

왜 이렇게 만들었나:

- **사용자의 키는 절대 브라우저를 떠나지 않습니다.** 서명은 사용자가 이미 신뢰하는 지갑 확장 안에서 일어납니다. 어드바이저는 사용자를 가장할 수 없고, 단지 브라우저가 지갑에게 *물어보도록 요청*할 수 있을 뿐입니다.
- **서버에 사용자별 RPC 캐시가 없습니다.** 브라우저는 이미 사용자가 어느 체인에 있는지, 어떤 토큰을 보유하는지, 어떤 포지션이 있는지 알고 있습니다. AI 는 그 정보가 사는 곳에서 직접 읽습니다.
- **읽기, 계산, 쓰기가 같은 루프로 처리됩니다.** "잔액 읽기" 호출과 "서명 요청" 호출은 AI 입장에서 동일합니다 — 같은 호출 형태, 같은 스키마 검증, 같은 `tool_result`. 어드바이저는 별도의 "실행 모드" 가 필요 없습니다.
- **스키마 검증된 transcript.** 어드바이저가 거친 모든 단계가 `(tool_call, tool_result)` 페어입니다. 디버깅은 transcript 를 읽는 것이지, 서버가 무엇을 한다고 생각했는지 재구성하는 게 아닙니다.

### 3. LP 추천 카드 (항상 3장)

LP 추천은 매번 정확히 3장의 카드로 렌더됩니다 — `preservation` tier 든 잔액이 0 이든 예외 없습니다. 보수성은 카드 개수를 줄이는 게 아니라 어드바이저가 *어떤 풀 3개*를 고르는지(예: 같은 stable-stable 페어의 다른 fee tier 3개, 또는 stable-stable 1 + 보수적 stable-volatile 2)로 표현됩니다.

각 카드는 어드바이저가 취할 온체인 단계를 인코딩하고 있어, 사용자가 클릭하는 순간 지갑은 이미 무엇을 서명할지 알고 있습니다.

### 4. 실행 모달 + 자동 체인 전환

카드를 클릭하면 전용 실행 모달이 열리고, 네 단계로 진행됩니다:

```
idle  →  executing  →  complete
                   ↘   error  (재시도)
```

서명을 요청하기 전, 모달이 지갑을 HyperEVM(체인 999) 으로 자동 전환합니다. 사용자가 다른 체인에 있으면 지갑이 전환을 묻습니다 — 서명 도중 헷갈리는 `chain mismatch` 실패가 일어나지 않습니다.

### 5. SIWE 지갑 인증

인증은 **Sign-In With Ethereum** 으로 이뤄집니다: 백엔드의 challenge, 사용자 지갑의 서명, 해당 주소에 바인딩된 JWT. JWT 는 local storage 로 리로드 후에도 살아남아, 지갑이 연결된 상태로 채팅 URL 을 공유할 수 있습니다. 하드코딩된 bearer 토큰 없음, dev-bypass 없음.

### 6. 프로덕션 빌드 가드

Next.js 설정이 다음 조건이 **모두** 충족되지 않으면 production build 를 거부합니다:

- `NEXT_PUBLIC_DEFIPILOT_ENV=prod`
- `DEFIPILOT_ENV=prod`
- `DEFIPILOT_DEMO_BANNER=false`
- `NEXT_PUBLIC_DEFAULT_CHAIN_ID=999`
- `HYPEREVM_RPC_URL` 이 비어있지 않음

잘못 구성된 prod env 는 사용자 앞 런타임이 아니라 빌드 단계에서 즉시 throw 됩니다.

---

## 아키텍처

DefiPilot 은 단일 페이지 웹 앱입니다. 채팅 백엔드는 LLM 의 토큰과 tool-call 요청을 스트리밍하는 별도 서비스이며, 사용자 지갑·잔액·체인을 건드리는 모든 것은 브라우저 탭 안에서 인라인으로 실행됩니다.

```
┌────────────────────────────────────────────────────────────────────┐
│                            DefiPilot                               │
│   Landing → Connect Wallet (SIWE) → Survey → Tier Result → Chat    │
│                                                                    │
│  ┌─────────────────────────┐    ┌──────────────────────────────┐  │
│  │  좌측 패널              │    │  우측 패널 (chat)            │  │
│  │  투자자 성향 리포트     │    │  AI 어드바이저 + LP 카드 +   │  │
│  │  (KOFIA tier + score)   │    │  실행 모달                   │  │
│  └─────────────────────────┘    └──────────────┬───────────────┘  │
│                                                 │                  │
│                         ┌───────────────────────┴───────────┐      │
│                         │   브라우저 네이티브 tool 런타임  │      │
│                         │   • 타입 안전 함수 레지스트리    │      │
│                         │   • 스키마 검증된 tool_call      │      │
│                         │   • 지갑 read & sign 요청        │      │
│                         └───────────────────────┬───────────┘      │
└─────────────────────────────────────────────────┼──────────────────┘
                       SSE 채팅 스트림            │   wallet API
                       (token + tool_call)        │
                                ▲                 ▼
                                │           사용자 지갑 확장
                  ┌─────────────┴────────────┐  (in-place 서명)
                  │   채팅 백엔드             │
                  │   (LLM 스트리밍 +         │
                  │    tool_call 라우팅)      │
                  └───────────────────────────┘
```

구체적으로:

1. 사용자가 본인 지갑(SIWE)으로 DefiPilot 에 로그인하고 설문을 완료합니다.
2. 채팅 백엔드가 어드바이저의 응답을 스트리밍합니다. 스트림 도중 어드바이저는 `tool_call` 을 발사할 수 있습니다.
3. 브라우저가 `tool_call` 을 수신하고, 함수의 스키마로 인자를 검증한 뒤, 함수를 로컬에서 실행하고 결과를 돌려줍니다.
4. 어드바이저가 결과를 소비하고, 추가 tool 을 호출하거나 메시지를 마무리합니다.
5. 어드바이저가 LP 카드를 제안하고 사용자가 그 중 하나를 클릭하면, 실행 모달이 체인 전환과 서명으로 사용자를 안내합니다 — 모든 서명은 사용자 지갑 확장 안에서 일어나며, 서버에서는 절대 일어나지 않습니다.

### 레포지토리 레이아웃

| 경로 | 설명 |
|------|------|
| `apps/web` | Next.js 15 프론트엔드 — DefiPilot UX 전체 |
| `apps/web/src/domains/landing` | Hero + 동작 방식 narrative |
| `apps/web/src/domains/survey` | KOFIA 10문항 설문 + tier 도출 |
| `apps/web/src/domains/wallet` | 지갑 연결 flow + connect-wallet 모달 |
| `apps/web/src/domains/auth` | SIWE challenge / sign / verify |
| `apps/web/src/domains/agent` | 브라우저 네이티브 tool 런타임 + 함수 핸들러 |
| `apps/web/src/domains/chat` | Chat UI, LP 카드, 실행 모달 |
| `apps/web/src/domains/positions` | 기존 포지션 뷰 |
| `apps/web/src/lib` | 지갑 설정, 체인 레지스트리, auth storage, 프롬프트 |
| `docs/phases/` | 버전별 PRD + design + DoD + progress (v1.0.0 → v1.3.2) |
| `docs/seabw-system-prompt.md` | DefiPilot 페르소나 / 톤 / 규칙 |
| `e2e/` | Playwright 스모크 슈트 (수동 실행만) |
| `.github/workflows/ci.yml` | install · typecheck · lint · test · build |

---

## 데모 시나리오

**"설문에서 온체인 LP 까지, 3분 안에."**

```
Step 1  │  사용자가 / 진입, "Connect wallet to start" 클릭
        │  → 지갑 열림 → 주소 선택
        │
Step 2  │  SIWE challenge → 사용자 서명 → JWT 발급
        │  → JWT 가 local 에 캐시 (리로드 후에도 유지)
        │
Step 3  │  KOFIA 10문항 설문
        │  → tier 도출 (예: "balanced", rawScore 18)
        │  → 바운드: maxLpCapUsd $5,000, maxBridges 1
        │
Step 4  │  Chat 화면 진입. Split-screen:
        │   좌측 = 리포트 (tier + score + 답변)
        │   우측 = AI 어드바이저, profile 사전 주입됨
        │
Step 5  │  어드바이저가 브라우저를 호출해 사용자 상태를 읽음
        │   (지갑, 잔액, 기존 포지션, 후보 풀).
        │   각 호출은 한 번의 tool_call → tool_result 왕복.
        │
Step 6  │  어드바이저가 LP 카드 3장 제안:
        │   #1 USDC/USD₮0 0.05% (stable-stable, 저위험)
        │   #2 USDC/USD₮0 0.30% (stable-stable, 높은 수수료)
        │   #3 WHYPE/USDC 0.30% (보수적 stable-volatile)
        │
Step 7  │  사용자가 #1 클릭
        │   → 실행 모달 open
        │   → 모달: "idle" (준비 중…)
        │
Step 8  │  사용자가 "Execute" 클릭
        │   → HyperEVM(체인 999) 자동 전환
        │   → 모달: "executing", step 진행도 표시
        │   → 각 단계가 사용자 지갑에서 서명됨
        │
Step 9  │  모든 단계 컨펌
        │   → 모달: "complete", tx hash 링크 표시
        │   → 포지션이 /positions 에 보임 ✓
```

체인 mismatch, simulation revert, 사용자 거절 — 무엇이 실패하든 모달은 `error` 단계로 가서 단일 Retry 버튼을 노출합니다. 묵음 실패 없음.

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| **Frontend** | Next.js 15 (App Router), React 19, TailwindCSS v4, Radix UI |
| **Wallet / Sign** | wagmi v2, viem, WalletConnect v2, SIWE |
| **AI Runtime** | 스키마 검증된 `tool_call` / `tool_result` SSE 왕복을 가진 브라우저 네이티브 tool 런타임 |
| **Auth** | SIWE (challenge → 지갑 서명 → verify → JWT) |
| **Testing** | Vitest (unit / integration), Playwright (e2e 수동) |
| **CI** | GitHub Actions — install · typecheck · lint · test · build |
| **Blockchain** | HyperEVM (Chain ID: 999), HYPE 네이티브 |

---

## 시작하기

### 사전 조건

- Node.js ≥ 20, pnpm ≥ 10
- HTTPS/SSE 로 접근 가능한 채팅 백엔드
- (선택) WalletConnect Cloud project ID — WalletConnect connector 용

### Quick Start

```bash
# 1. Clone & install
git clone <this-repo> defipilot
cd defipilot
pnpm install

# 2. Env setup
cp apps/web/.env.local.example apps/web/.env.local
# apps/web/.env.local 최소 설정:
#   NEXT_PUBLIC_AGENT_ORIGIN=http://localhost:3003
#   NEXT_PUBLIC_AGENT_BASE_URL=http://localhost:3003/api/v1
#   (선택) NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...

# 3. dev 서버 부팅
pnpm dev                # http://localhost:3000
```

### 검증

```bash
pnpm typecheck          # apps/web strict tsc
pnpm lint               # eslint flat config (max-warnings=0)
pnpm test               # vitest
pnpm build              # next build (prod env-guard 강제)
```

### 프로덕션 env 체크리스트

`NEXT_PUBLIC_DEFIPILOT_ENV=prod` 일 때 빌드는 다음이 **모두** 만족되지 않으면 throw:

- `DEFIPILOT_ENV=prod`
- `DEFIPILOT_DEMO_BANNER=false`
- `NEXT_PUBLIC_DEFAULT_CHAIN_ID=999`
- `HYPEREVM_RPC_URL` 비어있지 않음

잘못된 구성은 사용자가 아니라 빌드가 먼저 실패합니다.

---

## 팀

**Hypurrquant** — DeFi-native builders.

```
2024 Q1   AI 리서치 랩 → 온체인
   ↓
2024 Q3   HypurrQuant — DEX LP 관리 + 트레이딩 봇
   ↓
2025 Q1   HypurrQuant V2 — 멀티체인, non-custodial
   ↓
2025 Q4   ForwardX — 크로스 통화 DeFi operations
   ↓
2026 Q1   Snowball — Creditcoin full-stack DeFi
   ↓
2026 Q2   DefiPilot — KOFIA tier 기반 리테일 우선 DeFi 어드바이저
```

---

KOFIA 투자자 프레임워크 · wagmi v2 · viem · HyperEVM
