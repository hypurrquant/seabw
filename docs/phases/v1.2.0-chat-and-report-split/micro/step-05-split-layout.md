# Step 05: split-screen 레이아웃

## 메타데이터
- **난이도**: 🟡
- **선행 조건**: Step 04

## 구현 내용
1. `apps/web/src/app/page.tsx` chat case 를 split-screen으로 변경:
   ```tsx
   case "chat":
     return (
       <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100dvh-2.5rem)]">
         <aside className="border-r border-[color:var(--color-border)] overflow-y-auto">
           <TierResultView readOnly />
         </aside>
         <section className="overflow-y-auto">
           <Chat />
         </section>
       </div>
     );
   ```
2. `domains/survey/tier-result.tsx` 에 `readOnly` prop 추가
   - true면 "지갑 연결" "Retake survey" 등 stage 이동 버튼 숨김 (또는 비활성)
   - report 본문 (등급/배지/AllocationPreview/Bound 들) 그대로 표시

## 완료 조건
- [ ] DoD F9, F10 충족
- [ ] manual: lg 이상에서 좌/우 분할 확인. lg 이하에서는 stack
