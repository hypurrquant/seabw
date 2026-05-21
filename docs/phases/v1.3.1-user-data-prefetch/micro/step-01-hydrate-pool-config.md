# Step 01: hydratePoolConfig 추가

## 메타데이터
- **난이도**: 🟢
- **선행 조건**: 없음

## 구현 내용
- `HqBootProvider.tsx` 의 useEffect 안에서 `hydratePoolConfig()` 도 호출.
- 기존 `hydrateTokenConfig()` 와 병렬 실행 (Promise.all).

## 완료 조건
- [ ] 콘솔에 `[hq-boot] pool config hydrated` 로그 출력.
- [ ] typecheck 통과.

## Scope
### 수정 대상
- `apps/web/src/domains/agent/providers/HqBootProvider.tsx`
