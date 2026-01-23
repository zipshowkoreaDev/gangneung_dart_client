interface ResultScreenProps {
  name: string;
  score: number;
  onExit: () => void;
}

// 게임 결과 화면 (내 점수 표시)
export default function ResultScreen({ name, score, onExit }: ResultScreenProps) {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-[28px] font-bold text-white text-center">
        게임 완료!
      </div>

      <div className="w-full max-w-[320px] bg-white/10 rounded-3xl border border-white/20 p-8 backdrop-blur-sm">
        <div className="text-center text-white/70 text-lg mb-2">
          {name}
        </div>
        <div className="text-center">
          <span className="text-6xl font-bold text-[#FFD700]">{score}점</span>
          <span className="text-2xl text-white/80 ml-2">/ 3번 중</span>
        </div>
        <div className="text-center text-white/50 text-sm mt-4">
          {score === 3
            ? "완벽해요!"
            : score === 2
            ? "잘했어요!"
            : score === 1
            ? "아쉬워요!"
            : "다음엔 더 잘할 수 있어요!"}
        </div>
      </div>

      <button
        onClick={onExit}
        className="py-5 px-10 text-2xl font-bold rounded-2xl border-none bg-gradient-to-br from-[#FFD700] to-[#FFA500] text-black shadow-[0_8px_32px_rgba(255,215,0,0.4)] transition-all"
      >
        나가기
      </button>
    </div>
  );
}
