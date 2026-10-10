'use client';

import { useRef } from 'react';
import { minMoves } from '@/lib/hanoi';
import { En, EnLine } from './ui';

export const RULES = [
  ['원반은 한 번에 하나씩만 옮깁니다.', 'Move only one disc at a time.'],
  ['각 기둥의 맨 위 원반만 집을 수 있습니다.', 'Only the top disc of a peg can be picked up.'],
  ['큰 원반을 작은 원반 위에 올릴 수 없습니다.', 'A larger disc cannot go on a smaller one.'],
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
        <En>Help</En>
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
            <span className="font-sans text-[15px] font-normal text-ink-3"> / Help</span>
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
            <h3 className={sectionTitle}>
              게임 설명<En>About the game</En>
            </h3>
            <p>
              하노이탑은 기둥 세 개와 크기가 다른 원반 여러 개로 하는 퍼즐입니다. 처음에는 모든 원반이 1번 기둥에 큰
              것부터 차례로 쌓여 있습니다. 이 원반들을 규칙에 맞게 다른 기둥 하나로 모두 옮기면 됩니다.
              <EnLine>
                The Tower of Hanoi is a puzzle with three pegs and discs of different sizes. All discs start on peg 1,
                largest at the bottom. Move them all to one other peg while following the rules.
              </EnLine>
            </p>
            <p className="mt-1.5">
              원반이 n개면 최소 2ⁿ − 1번 옮겨야 합니다. 원반 3개는 {minMoves(3)}번, 8개는 {minMoves(8)}번입니다.
              <EnLine>
                With n discs it takes at least 2ⁿ − 1 moves: {minMoves(3)} for 3 discs, {minMoves(8)} for 8 discs.
              </EnLine>
            </p>
          </section>

          <section>
            <h3 className={sectionTitle}>
              게임 규칙<En>Rules</En>
            </h3>
            <ol className="flex flex-col gap-1">
              {RULES.map(([rule, en], i) => (
                <li key={rule} className="flex gap-2">
                  <span className="shrink-0 font-mono text-[12px] leading-[1.7rem] tracking-[.06em] text-brass">
                    규칙 {i + 1}
                  </span>
                  <span>
                    {rule}
                    <EnLine>
                      Rule {i + 1}: {en}
                    </EnLine>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className={sectionTitle}>
              게임 방법<En>How to play</En>
            </h3>
            <p className="mb-1.5">
              먼저 게임판 위 <b className="font-semibold text-ink">Player</b> 칸에 이름을 등록합니다. 다 풀면 이 이름으로
              랭킹에 바로 올라갑니다.
              <EnLine>
                First register your name in the Player box above the board. When you solve the puzzle, your record goes
                to the ranking under that name.
              </EnLine>
            </p>
            <p className="mb-1.5">
              상태 칸의 <b className="font-semibold text-ink">[준비]</b>를 누르면 Ready 5부터 세고, 0이 되면 시간이
              흐르며 게임이 시작됩니다. 원반을 옮긴 뒤에는 같은 자리가 <b className="font-semibold text-ink">[처음부터]</b>로
              바뀌어 누르면 새로 시작합니다. 게임 중에 왼쪽 위 <b className="font-semibold text-ink">[중지]</b>를 누르면 시간이 멈추고
              [준비] 상태로 돌아갑니다(기록은 남지 않습니다).
              <EnLine>
                Press [Ready] in the Status box to count down from 5; at 0 the clock starts. After your first move the
                same button becomes [Restart]. Press [Stop] at the top left during a game to stop the clock and go back
                to [Ready] (no record is kept).
              </EnLine>
            </p>
            <p>
              옮기고 싶은 원반을 먼저 누르고, 다음에 옮기고 싶은 자리의 기둥을 누르면 원반이 옮겨집니다. 이렇게 계속
              진행하고 다 옮기면 게임은 종료됩니다.
              <EnLine>
                Tap the disc you want to move, then tap the peg you want to move it to. Keep going until every disc is
                moved, and the game ends.
              </EnLine>
            </p>
            <p className="mt-1.5">
              키보드로는 <b className="font-semibold text-ink">13</b>처럼 숫자 두 개를 누르면 1번 기둥에서 3번 기둥으로
              옮깁니다.
              <EnLine>On a keyboard, type two digits such as 13 to move from peg 1 to peg 3.</EnLine>
            </p>
            <p className="mt-1.5">
              [자동 풀이]를 누르면 원반 3개짜리를 푸는 모습을 보여 줍니다.
              <EnLine>[Auto-solve] shows how the 3-disc puzzle is solved.</EnLine>
            </p>
          </section>

          <section>
            <h3 className={sectionTitle}>
              둘이 하기<En>Duel</En>
            </h3>
            <p className="mb-1.5">
              [둘이 하기]를 열면 접속자 목록이 보입니다. 비어 있는 사람 옆 [초대]를 누르면 상대에게 신청이 가고, 상대가
              [수락]하면 바로 대결 방이 열립니다. 초대한 사람이 방장입니다.
              <EnLine>
                Open [Duel] to see who is online. Press [Invite] next to a free player; when they press [Accept], a
                match room opens for you two. The one who invited is the host.
              </EnLine>
            </p>
            <p>
              방 코드로도 할 수 있습니다. [둘이 하기]에서 한 사람이 [방 만들기]를 누르고 나온 숫자 4자리를 친구에게 알려 줍니다. 친구는 그 코드를
              넣고 [참가]를 누릅니다. 방장이 원반 수를 고르고 [대결 시작]을 누르면 둘 다 Ready 5부터 세고, 먼저 다 옮긴
              사람이 이깁니다. 대결 중에 [중지]를 누르거나 나가면 집니다. 대결 기록은 랭킹에 올라가지 않습니다.
              <EnLine>
                In [Duel], one player presses [Create room] and shares the 4-digit code. The friend enters the code and
                presses [Join]. The host picks the number of discs and presses [Start match]; both count down from
                Ready 5 and whoever finishes first wins. Pressing [Stop] or leaving during a match is a loss. Duel
                records are not added to the ranking.
              </EnLine>
            </p>
          </section>
        </div>
      </dialog>
    </>
  );
}
