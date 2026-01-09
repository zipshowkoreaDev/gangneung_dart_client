interface ModeSelectionProps {
  customName: string;
  setCustomName: (name: string) => void;
  playerCount: number;
  isSoloRunning: boolean;
  isRoomFull: boolean;
  nameError: string;
  isSoloDisabled: boolean;
  isDuoDisabled: boolean;
  onModeSelect: (mode: "solo" | "duo") => void;
}

export default function ModeSelection({
  customName,
  setCustomName,
  playerCount,
  isSoloRunning,
  isRoomFull,
  nameError,
  isSoloDisabled,
  isDuoDisabled,
  onModeSelect,
}: ModeSelectionProps) {
  return (
    <>
      <div className="text-[28px] font-bold text-white text-center">
        다트 게임
      </div>

      <div className="flex flex-col gap-4 w-full max-w-[300px]">
        <input
          type="text"
          value={customName}
          onChange={(e) => {
            const value = e.target.value;
            if (value.length <= 5) {
              setCustomName(value);
            }
          }}
          placeholder="이름 입력 (최대 5글자)"
          maxLength={5}
          disabled={isSoloRunning}
          className={`p-4 text-lg font-semibold rounded-xl border-2 border-white/30 text-white text-center outline-none backdrop-blur-[10px] ${
            isSoloRunning
              ? "bg-white/5 opacity-60"
              : "bg-white/10 opacity-100"
          }`}
        />

        {playerCount > 0 && (
          <div className="text-sm text-white opacity-70 text-center">
            현재 방 인원: {playerCount}명
            {playerCount > 1 && " (혼자하기 불가)"}
          </div>
        )}
        {isSoloRunning && (
          <div className="text-xs text-[#ffdddd] text-center opacity-80">
            혼자하기가 진행 중입니다.
          </div>
        )}
        {isRoomFull && (
          <div className="text-xs text-[#ffdddd] text-center opacity-80">
            지금은 플레이 중이라 이용할 수 없습니다
          </div>
        )}
        {nameError && (
          <div className="text-xs text-[#ffdddd] text-center opacity-80">
            {nameError}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 w-full max-w-[300px]">
        <button
          onClick={() => onModeSelect("solo")}
          disabled={isSoloDisabled}
          className={`py-5 px-10 text-2xl font-bold rounded-2xl border-none transition-all duration-300 ${
            isSoloDisabled
              ? "bg-gray-500 text-gray-300 cursor-not-allowed opacity-50"
              : "bg-gradient-to-br from-[#FFD700] to-[#FFA500] text-black cursor-pointer shadow-[0_8px_32px_rgba(255,215,0,0.4)]"
          }`}
        >
          혼자
          {playerCount > 1 && (
            <div className="text-xs mt-1">(다른 플레이어 있음)</div>
          )}
        </button>

        <button
          onClick={() => onModeSelect("duo")}
          disabled={isDuoDisabled}
          className={`py-5 px-10 text-2xl font-bold rounded-2xl border-none text-white transition-all duration-300 ${
            isDuoDisabled
              ? "bg-gray-500 cursor-not-allowed opacity-50"
              : "bg-gradient-to-br from-[#4CAF50] to-[#45a049] cursor-pointer shadow-[0_8px_32px_rgba(76,175,80,0.4)]"
          }`}
        >
          둘이서
        </button>
      </div>
    </>
  );
}
