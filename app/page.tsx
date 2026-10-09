import HanoiGame from '@/components/HanoiGame';

export default function Home() {
  return (
    <div className="wrap">
      <header>
        <div className="eyebrow">Tower of Hanoi</div>
        <h1>하노이탑</h1>
        <p className="lede">
          기둥을 눌러 원반을 집고, 다른 기둥을 눌러 내려놓습니다. 모든 원반을 <b>오른쪽 기둥</b>으로 옮기면 끝.
          키보드 <b>1 2 3</b>도 같은 역할을 합니다.
        </p>
      </header>

      <HanoiGame />

      <div className="rules">
        <div className="rule">
          <div className="n">규칙 1</div>
          <p>원반은 한 번에 하나씩만 옮깁니다.</p>
        </div>
        <div className="rule">
          <div className="n">규칙 2</div>
          <p>각 기둥의 맨 위 원반만 집을 수 있습니다.</p>
        </div>
        <div className="rule">
          <div className="n">규칙 3</div>
          <p>큰 원반을 작은 원반 위에 올릴 수 없습니다.</p>
        </div>
      </div>

      <div className="legend">
        <h2>64개의 원반</h2>
        <p>
          인도 바라나시의 어느 사원에 다이아몬드 기둥 셋과 황금 원반 예순넷이 있고, 승려들이 밤낮으로 그것을 옮기고
          있다는 이야기가 전해집니다. 마지막 원반이 제자리에 놓이는 순간 세상이 끝난다고 합니다.
        </p>
        <p>다행히 시간은 넉넉합니다. 원반 64개를 옮기려면 최소</p>
        <p className="big-num">18,446,744,073,709,551,615회</p>
        <p>가 필요하고, 1초에 한 번씩 쉬지 않고 옮겨도 약 5,850억 년이 걸립니다. 우주 나이의 마흔 배쯤 됩니다.</p>
      </div>
    </div>
  );
}
