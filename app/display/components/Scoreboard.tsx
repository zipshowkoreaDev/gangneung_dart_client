"use client";

type PlayerScore = {
  name: string;
  score: number;
  isConnected: boolean;
  isReady: boolean;
  totalThrows: number;
  currentThrows: number;
};

type ScoreboardProps = {
  players: Map<string, PlayerScore>;
  currentTurn: string | null;
  isSoloMode: boolean;
};

export default function Scoreboard({
  players,
  currentTurn,
  isSoloMode,
}: ScoreboardProps) {

  const playerList = Array.from(players.values());
  const playerOne = playerList[0];
  const playerTwo = playerList[1];
  const isSoloDisplay = isSoloMode || playerList.length <= 1;
  const slots = isSoloDisplay ? [playerOne] : [playerOne, playerTwo];

  const renderPlayerCard = (
    player: PlayerScore | undefined,
    showSoloBadge: boolean,
    showStatus: boolean
  ) => {
    if (!player) {
      return (
        <div className="flex-1 flex items-center justify-center bg-white/5 p-5 rounded-lg text-base opacity-60">
          플레이어를 기다리는 중...
        </div>
      );
    }

    return (
      <div
        className="flex-1 flex flex-col items-center justify-center gap-2 p-5 rounded-lg transition-all"
        style={{
          background:
            currentTurn === player?.name
              ? "rgba(76, 175, 80, 0.3)"
              : "rgba(255, 255, 255, 0.05)",
          border:
            currentTurn === player?.name
              ? "3px solid #4CAF50"
              : "3px solid transparent",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[1.5rem] font-bold">{player?.name}</span>
          {currentTurn === player?.name && (
            <span className="text-[1rem] bg-[#4CAF50] text-white px-2 py-1 rounded-md font-semibold">
              턴 ({player?.currentThrows}/3)
            </span>
          )}
        </div>
        <div className="text-[2rem] font-bold text-[#FFD700]">
          {player?.score}점
        </div>
        <div className="text-[0.75rem] opacity-70">
          {player?.totalThrows}회 던짐
          {showStatus && (
            <>
              {player?.isConnected
                ? player?.isReady
                  ? "준비 완료"
                  : "대기 중"
                : "나감"}
            </>
          )}
        </div>
        {showSoloBadge && (
          <div className="text-[0.75rem] text-[#FFD700] mt-2">
            혼자하기 모드
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="absolute top-0 left-0 w-full bg-white/20 backdrop-blur-md flex gap-5 p-5 z-10 shadow-md">
      {slots.map((player, index) => (
        <div key={player?.name || `slot-${index}`} className="flex-1">
          {renderPlayerCard(
            player,
            isSoloMode && index === 0,
            !isSoloDisplay
          )}
        </div>
      ))}
    </div>
  );
}

export type { PlayerScore };
