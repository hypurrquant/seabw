# Step 04: Marketplace plan 실패 응답 shape 복원

## 메타데이터
- **난이도**: 🟢
- **선행 조건**: 없음

## 구현 내용
- `MarketplaceService.composeBasket` 의 try/finally 에 catch 추가:
  - return `{ status: 500, body: { error: \`Couldn't build basket plan: \${msg}\` } }`

## 완료 조건
- [ ] catch 블록 존재
- [ ] 응답 메시지가 `"Couldn't build basket plan: "` 로 시작

## Scope
### 수정 대상
- `apps/server/src/domains/marketplace/marketplace.service.ts`
