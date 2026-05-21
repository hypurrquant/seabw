# Step 04: Pipeline Ready inline 카드 제거

## 메타데이터
- **난이도**: 🟢
- **선행 조건**: Step 02

## 구현 내용
- `chat.tsx` 에서 `PipelineReadyCard` mount 부분 제거.
- `pipeline-ready-card.tsx` 파일은 일단 보존 (zero-reference 상태로 둠 — 다음 phase 에서 dead code 정리).
- AI 가 compose_pipeline 호출하면 store update 는 정상 발생 (다른 코드가 의존할 수 있음), 단 채팅엔 시각적 영향 없음.

## 완료 조건
- [ ] DOM 검사: `Pipeline Ready` Pill 더 이상 채팅에 안 보임
- [ ] AI 가 compose_pipeline 호출해도 채팅 변화 없음 (LP 카드 클릭이 유일한 trigger)
- [ ] typecheck/lint 통과

## Scope
### 수정 대상
- `apps/web/src/domains/chat/chat.tsx` — PipelineReadyCard import/mount 제거
