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
  isMounted: boolean;
  players: Map<string, PlayerScore>;
  currentTurn: string | null;
  isSoloMode: boolean;
};

export default function Scoreboard({
  isMounted,
  players,
  currentTurn,
  isSoloMode,
}: ScoreboardProps) {
  if (!isMounted) return null;

  const playerList = Array.from(players.values());
  const playerOne = playerList[0];
  const playerTwo = playerList[1];

  return (
    <div className="fixed top-0 left-0 w-full bg-white/50 backdrop-blur-md flex gap-5 p-5 z-10">
      {/* 플레이어 1 */}
      {playerOne ? (
        <div
          className="flex-1 flex flex-col items-center justify-center gap-2 p-5 rounded-lg transition-all"
          style={{
            background:
              currentTurn === playerOne?.name
                ? "rgba(76, 175, 80, 0.3)"
                : "rgba(255, 255, 255, 0.05)",
            border:
              currentTurn === playerOne?.name
                ? "3px solid #4CAF50"
                : "3px solid transparent",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[1.5rem] font-bold">{playerOne?.name}</span>
            {currentTurn === playerOne?.name && (
              <span className="text-[1rem] bg-[#4CAF50] text-white px-2 py-1 rounded-md font-semibold">
                턴 ({playerOne?.currentThrows}/3)
              </span>
            )}
          </div>
          <div className="text-[2rem] font-bold text-[#FFD700]">
            {playerOne?.score}점
          </div>
          <div className="text-[0.75rem] opacity-70">
            {playerOne?.totalThrows}회 던짐
            {!isSoloMode && (
              <>
                {playerOne?.isConnected
                  ? playerOne?.isReady
                    ? "준비 완료"
                    : "대기 중"
                  : "나감"}
              </>
            )}
          </div>
          {isSoloMode && (
            <div className="text-[0.75rem] text-[#FFD700] mt-2">
              혼자하기 모드
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255, 255, 255, 0.05)",
            padding: "20px",
            borderRadius: 12,
            fontSize: 16,
            opacity: 0.6,
          }}
        >
          플레이어를 기다리는 중...
        </div>
      )}

      {/* 플레이어 2 */}
      {!isSoloMode && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: playerTwo
              ? currentTurn === playerTwo?.name
                ? "rgba(76, 175, 80, 0.3)"
                : "rgba(255, 255, 255, 0.05)"
              : "rgba(255, 255, 255, 0.05)",
            padding: "20px",
            borderRadius: 12,
            border: playerTwo
              ? currentTurn === playerTwo?.name
                ? "3px solid #4CAF50"
                : "3px solid transparent"
              : "3px solid transparent",
            transition: "all 0.3s ease",
          }}
        >
          {playerTwo ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 24, fontWeight: 700 }}>
                  {playerTwo?.name}
                </span>
                {currentTurn === playerTwo?.name && (
                  <span
                    style={{
                      fontSize: 12,
                      background: "#4CAF50",
                      color: "white",
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontWeight: 600,
                    }}
                  >
                    턴 ({playerTwo?.currentThrows}/3)
                  </span>
                )}
              </div>
              <div style={{ fontSize: 48, fontWeight: 700, color: "#FFD700" }}>
                {playerTwo?.score}점
              </div>
              <div style={{ fontSize: 14, opacity: 0.7 }}>
                {playerTwo?.totalThrows}회 던짐 ?{" "}
                {playerTwo?.isConnected
                  ? playerTwo?.isReady
                    ? "준비 완료"
                    : "대기 중"
                  : "나감"}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 16, opacity: 0.6 }}>
              플레이어를 기다리는 중...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export type { PlayerScore };
