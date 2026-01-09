interface ModeWaitingProps {
  selectedMode: "solo" | "duo";
  customName: string;
  playerCount: number;
  isWaitingForDuo: boolean;
}

export default function ModeWaiting({
  selectedMode,
  customName,
  playerCount,
  isWaitingForDuo,
}: ModeWaitingProps) {
  return (
    <div className="text-center text-white">
      <div className="text-[28px] font-bold mb-4">
        {selectedMode === "solo" ? "혼자하기" : "둘이서 하기"} 모드
      </div>
      {isWaitingForDuo && (
        <div className="text-sm opacity-80 mb-2">
          플레이어 2를 기다리는 중...
        </div>
      )}
      <div className="text-base opacity-80">플레이어: {customName}</div>
      <div className="text-sm opacity-60 mt-2">현재 인원: {playerCount}명</div>
    </div>
  );
}
