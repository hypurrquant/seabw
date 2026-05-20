# Step 01: 디렉토리 생성 + 파일 이동

## 메타데이터
- **난이도**: 🟡
- **선행 조건**: 없음

## 구현 내용
1. `apps/web/src/domains/{landing,survey,wallet,chat,portfolio}/` 생성
2. `git mv` 또는 `mv` 로 파일 이동:
   - `components/landing.tsx` → `domains/landing/landing.tsx`
   - `components/survey.tsx` → `domains/survey/survey.tsx`
   - `components/tier-result.tsx` → `domains/survey/tier-result.tsx`
   - `lib/survey.ts` → `domains/survey/lib.ts`
   - `components/connect-wallet.tsx` → `domains/wallet/connect-wallet.tsx`
   - `components/chat.tsx` → `domains/chat/chat.tsx`
3. `domains/portfolio/.gitkeep` placeholder 생성

## 완료 조건
- [ ] DoD F1, F2, F3, F4 충족
- [ ] `git status` 로 이동 확인

## Scope

### 신규 디렉토리
- `apps/web/src/domains/{landing,survey,wallet,chat,portfolio}/`

### 이동
(위 매핑 6개)

### 유지
- `components/{ui,providers,site-header,demo-banner}.tsx`
- `lib/{wagmi,chains,utils}.ts`
- `state/app-state.tsx`
- `app/*`
