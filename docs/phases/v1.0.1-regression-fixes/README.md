# v1.0.0 회귀/누락 패치 - v1.0.1

## 문제 정의

### 현상
v1.0.0(monorepo + codex)의 6개 API 이전 과정에서 Codex 코드 리뷰가 8가지
실제 동작 회귀/누락을 발견. 외부 path/shape 호환 유지를 DoD에 명시했으나
실패 경로의 envelope · status code · 감사 로그 · runtime validation이 일부
변형되었거나 빠짐.

### 목표
src/ 원본의 외부 계약과 안전망(감사 로그·스키마 검증·status code)을 apps/
구현에서 그대로 복원. Codex(acpx) 파이프라인의 abort/timeout 정합성도 같이
정리.

### 비목표
- 새 기능 추가 / 신규 엔드포인트
- src/ 수정 (계속 휴면 보존)
- 6개 controller에 대한 supertest 풀 이전은 후속 phase로

### 제약사항
- 외부 path/shape는 v1.0.0 DoD 결정대로 유지
- src/ 디렉토리 baseline (72 파일) 그대로
