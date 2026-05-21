# DoD - v1.3.2

## 완료 조건

| # | 조건 | 검증 방법 |
|---|------|----------|
| 1 | LP 카드 1개 클릭 시 모달 open + recipe 기반 pipeline resolve 시작 | 브라우저 데모: 카드 클릭 → 모달 등장 → "준비 중..." → "Execute" 버튼 |
| 2 | 모달의 Execute 클릭 시 wallet 이 chain 999 아니면 자동 switchChain | 브라우저: wallet 을 다른 chain 으로 설정 후 Execute → MetaMask switch 프롬프트 자동 등장 |
| 3 | switchChain 성공 후 정상 tx 진행 (viem `chain: undefined` 에러 사라짐) | 브라우저 콘솔: 기존 "chain mismatch" 에러 없음 |
| 4 | 채팅에 Pipeline Ready inline 카드 더 이상 렌더되지 않음 | DOM 검사: AI 가 compose_pipeline 호출해도 inline 카드 mount 안 됨 |
| 5 | 모달 phase: idle / executing / complete / error 전이 시각적 확인 | 정상 실행 / 실행 중 / 완료 / 에러 4가지 케이스 데모 |

## 기본 검증
- [ ] `pnpm typecheck` 통과
- [ ] `pnpm lint` 통과
- [ ] `pnpm build` 통과
- [ ] `pnpm test` 통과 (기존 21 + 신규)
