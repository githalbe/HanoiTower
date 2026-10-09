import HanoiGame from '@/components/HanoiGame';

const RULES = [
  '원반은 한 번에 하나씩만 옮깁니다.',
  '각 기둥의 맨 위 원반만 집을 수 있습니다.',
  '큰 원반을 작은 원반 위에 올릴 수 없습니다.',
];

export default function Home() {
  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-6 px-3.5 pt-8 pb-12 sm:gap-[30px] sm:px-5 sm:pt-12 sm:pb-16">
      <header className="flex flex-col gap-2">
        <div className="font-mono text-[11px] font-medium uppercase tracking-[.22em] text-brass">Tower of Hanoi</div>
        <h1 className="font-serif text-[clamp(34px,7vw,52px)] leading-[1.12] font-bold tracking-[-.01em] text-balance">
          하노이탑
        </h1>
        <p className="max-w-[62ch] text-ink-2">
          기둥을 눌러 원반을 집고, 다른 기둥을 눌러 내려놓습니다. 키보드로는{' '}
          <b className="font-semibold text-ink">13</b>처럼 숫자 두 개를 누르면 1번 기둥에서 3번 기둥으로 옮깁니다. 모든
          원반을 <b className="font-semibold text-ink">다른 기둥 하나</b>로 옮기면 끝.
        </p>
      </header>

      <HanoiGame />

      <div className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-3">
        {RULES.map((rule, i) => (
          <div key={rule} className="bg-panel px-4 py-3.5">
            <div className="font-mono text-[11px] tracking-[.1em] text-brass">규칙 {i + 1}</div>
            <p className="mt-1 text-sm/[1.6] text-ink-2">{rule}</p>
          </div>
        ))}
      </div>

      <div className="max-w-[64ch] border-t border-line pt-[22px] text-sm/[1.6] text-ink-2 [&_p]:mb-2.5">
        <h2 className="mb-2 font-serif text-[19px] font-bold text-ink">64개의 원반</h2>
        <p>
          인도 바라나시의 어느 사원에 다이아몬드 기둥 셋과 황금 원반 예순넷이 있고, 승려들이 밤낮으로 그것을 옮기고
          있다는 이야기가 전해집니다. 마지막 원반이 제자리에 놓이는 순간 세상이 끝난다고 합니다.
        </p>
        <p>다행히 시간은 넉넉합니다. 원반 64개를 옮기려면 최소</p>
        <p className="font-mono text-[13px] break-all text-brass tabular-nums">18,446,744,073,709,551,615회</p>
        <p>가 필요하고, 1초에 한 번씩 쉬지 않고 옮겨도 약 5,850억 년이 걸립니다. 우주 나이의 마흔 배쯤 됩니다.</p>
      </div>
    </div>
  );
}
