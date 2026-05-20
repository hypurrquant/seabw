# Step 02: System prompt 작성

## 메타데이터
- **난이도**: 🟢
- **선행 조건**: 없음

## 구현 내용
- `docs/seabw-system-prompt.md` 신규
- 내용:
  - "당신은 DefiPilot. 사용자의 KOFIA 기반 설문 결과를 바탕으로 LP 추천·실행을 도와주는 어드바이저."
  - 응답 톤: 한국어 우선, 친절·구체·근거. tier별 hard cap 존중.
  - 단위: LP=APR, Lending=APY
  - 안전: 서명 강요 금지, 사용자 확인 후 실행
  - 사용 가능 tool 안내 — HQ의 tool 이름과 정합 (get_pools, compose_pipeline 등)
- 길이 2~4KB 권장

## 완료 조건
- [ ] DoD F14 충족
