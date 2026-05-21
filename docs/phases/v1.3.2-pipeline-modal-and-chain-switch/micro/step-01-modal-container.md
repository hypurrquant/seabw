# Step 01: ModalContainer 베이스 컴포넌트

## 메타데이터
- **난이도**: 🟢
- **선행 조건**: 없음

## 구현 내용
- `components/ui/modal-container.tsx` 신규: backdrop + center card + esc/backdrop close.
- props: `isOpen, onClose, closeOnBackdrop, size?: 'sm'|'md'|'lg'`.
- seabw 컬러톤: `bg-[color:var(--color-bg)]/80` backdrop, `bg-[color:var(--color-surface)] border-[color:var(--color-border)]` panel.
- `components/ui/index.ts` 에 export 추가.

## 완료 조건
- [ ] esc 키 누르면 onClose 호출
- [ ] backdrop 클릭 시 closeOnBackdrop=true 이면 onClose
- [ ] isOpen=false 시 mount 안 됨 (portal 안 만들어도 OK)
- [ ] z-index 가 connect-wallet-modal 과 겹쳐도 자연스러움

## Scope
### 신규 생성
- `apps/web/src/components/ui/modal-container.tsx` — 공용 모달 베이스

### 수정 대상
- `apps/web/src/components/ui/index.ts` — export 추가
