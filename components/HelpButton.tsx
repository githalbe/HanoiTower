'use client';

import { useRef } from 'react';
import { minMoves } from '@/lib/hanoi';

export const RULES = [
  '원반은 한 번에 하나씩만 옮깁니다.',
  '각 기둥의 맨 위 원반만 집을 수 있습니다.',
  '큰 원반을 작은 원반 위에 올릴 수 없습니다.',
];

const sectionTitle = 'mb-1.5 font-serif text-[17px] font-bold text-ink';

// 제목 오른쪽의 [도움말]. 누르면 게임 설명·규칙·방법을 담은 창이 뜬다
export default function HelpButton() {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[3px] border border-line bg-panel px-3 py-1.5 text-sm/[1.6] text-ink transition-colors hover:border-ink-3 hover:bg-panel-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
      >
        <span
          aria-hidden
          className="flex size-[18px] items-center justify-center rounded-full border-[1.5px] border-brass font-mono text-[11px] leading-none font-semibold text-brass"
        >
          ?
        </span>
        도움말
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="helpTitle"
        // 창 바깥 어두운 곳을 누르면 닫는다
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        className="m-auto w-[calc(100%-32px)] max-w-[480px] rounded border border-line bg-panel p-0 text-ink shadow-[0_12px_32px_var(--shadow)] backdrop:bg-black/45"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 id="helpTitle" className="font-serif text-[19px] font-bold">
            도움말
          </h2>
          <button
            type="button"
            aria-label="도움말 닫기"
            onClick={() => dialog.current?.close()}
            className="flex size-8 cursor-pointer items-center justify-center rounded-[3px] text-xl leading-none text-ink-2 hover:bg-panel-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brass"
          >
            ×
          </button>
        </div>

        <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-5 py-4 text-sm/[1.7] text-ink-2">
          <section>
            <h3 className={sectionTitle}>게임 설명</h3>
            <p>
              하노이탑은 기둥 세 개와 크기가 다른 원반 여러 개로 하는 퍼즐입니다. 처음에는 모든 원반이 1번 기둥에 큰
              것부터 차례로 쌓여 있습니다. 이 원반들을 규칙에 맞게 다른 기둥 하나로 모두 옮기면 됩니다.
            </p>
            <p className="mt-1.5">
              원반이 n개면 최소 2ⁿ − 1번 옮겨야 합니다. 원반 3개는 {minMoves(3)}번, 8개는 {minMoves(8)}번입니다.
            </p>
          </section>

          <section>
            <h3 className={sectionTitle}>게임 규칙</h3>
            <ol className="flex flex-col gap-1">
              {RULES.map((rule, i) => (
                <li key={rule} className="flex gap-2">
                  <span className="shrink-0 font-mono text-[12px] leading-[1.7rem] tracking-[.06em] text-brass">
                    규칙 {i + 1}
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className={sectionTitle}>게임 방법</h3>
            <p className="mb-1.5">
              상태 칸의 <b className="font-semibold text-ink">[준비]</b>를 누르면 Ready 5부터 세고, 0이 되면 시간이
              흐르며 게임이 시작됩니다. 원반을 옮긴 뒤에는 같은 자리가 <b className="font-semibold text-ink">[처음부터]</b>로
              바뀌어 누르면 새로 시작합니다.
            </p>
            <p>
              옮기고 싶은 원반을 먼저 누르고, 다음에 옮기고 싶은 자리의 기둥을 누르면 원반이 옮겨집니다. 이렇게 계속
              진행하고 다 옮기면 게임은 종료됩니다.
            </p>
            <p className="mt-1.5">
              키보드로는 <b className="font-semibold text-ink">13</b>처럼 숫자 두 개를 누르면 1번 기둥에서 3번 기둥으로
              옮깁니다.
            </p>
            <p className="mt-1.5">[자동 풀이]를 누르면 원반 3개짜리를 푸는 모습을 보여 줍니다.</p>
          </section>
        </div>
      </dialog>
    </>
  );
}
