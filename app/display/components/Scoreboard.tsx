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
};

export default function Scoreboard({
  players,
  currentTurn,
}: ScoreboardProps) {
  const playerList = Array.from(players.values());
  const playerOne = playerList[0];
  const playerTwo = playerList[1];
  const slots = [playerOne, playerTwo];

  const renderPlayerCard = (player: PlayerScore | undefined) => {
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
          {player?.score ? `${player?.score} 점` : ""}
        </div>
        <div className="text-[0.75rem] opacity-70">
          {player?.totalThrows ? `${player?.totalThrows}회 던짐` : ""}
        </div>
      </div>
    );
  };

  return (
    <div className="absolute top-0 left-0 w-full bg-white/20 backdrop-blur-md flex gap-5 p-5 z-10 shadow-md">
      {slots.map((player, index) => (
        <div
          key={player?.name || `slot-${index}`}
          className="flex-1 bg-white/40 rounded-lg"
        >
          {renderPlayerCard(player)}
        </div>
      ))}
    </div>
  );
}

export type { PlayerScore };
