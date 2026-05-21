# DoD - v1.3.1

## 완료 조건

| # | 조건 | 검증 방법 |
|---|------|----------|
| 1 | 부팅 시 HQ pool config + token config 둘 다 hydrated | 콘솔 `[hq-boot] token config hydrated` + `[hq-boot] pool config hydrated` |
| 2 | `/chat` 진입 시 "지갑 분석 중…" UI 노출 후 사라짐 | 브라우저 수동 |
| 3 | prefetch 완료 전엔 Chat 컴포넌트 마운트 안 됨 (첫 메시지 발사 X) | 콘솔 `[chat] creating HQ session` 로그가 prefetch 완료 후에 떠야 함 |
| 4 | prefetch 완료 후 AI `get_enriched_balances` 가 실제 토큰 잔액 반환 | 콘솔 + chat 흐름 |
| 5 | prefetch 실패 시 에러 메시지 + 재시도 버튼 | 수동 (network 끄고 시도) |

## 기본 검증
- [ ] `tsc --noEmit` 통과
- [ ] `pnpm --filter @seabw/web lint` 통과
- [ ] `pnpm test` 통과
- [ ] `pnpm build` 통과
