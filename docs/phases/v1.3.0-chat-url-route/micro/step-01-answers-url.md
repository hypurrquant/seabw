# Step 01: answers URL codec

## 메타데이터
- **난이도**: 🟢
- **선행 조건**: 없음

## 구현 내용
- `encodeAnswers(a: Answers): string` — JSON.stringify → base64url
- `decodeAnswers(s: string): Answers | null` — base64url → JSON.parse → `AnswersSchema.safeParse`
- base64url 변환 (RFC 4648, `+/=` → `-_`, padding 제거).
- 단위 테스트: round-trip + invalid 케이스 3종 (empty, malformed base64, schema mismatch).

## 완료 조건
- [ ] `encodeAnswers` 결과는 URL-safe 문자만 포함.
- [ ] `decodeAnswers` 가 valid 입력에 대해 원본 동일 객체 반환.
- [ ] invalid 입력에 대해 null 반환 (throw 금지).
- [ ] 단위 테스트 4건 통과.

## Scope
### 신규 생성
- `apps/web/src/lib/answers-url.ts` — codec 본체.
- `apps/web/src/lib/__tests__/answers-url.test.ts` — 단위 테스트.
