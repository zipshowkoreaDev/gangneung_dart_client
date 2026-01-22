interface WaitingScreenProps {
  aheadCount?: number | null;
  queue?: string[] | null;
}

export default function WaitingScreen({
  aheadCount,
  queue,
}: WaitingScreenProps) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-center text-white px-6">
      <div className="text-2xl font-bold mb-3">플레이 중입니다</div>
      <div className="text-sm opacity-80">잠시만 기다려주세요...</div>
      {typeof aheadCount === "number" && aheadCount >= 0 && (
        <div className="mt-3 text-xs opacity-70">
          내 앞 대기 인원: {aheadCount}명
        </div>
      )}
      {Array.isArray(queue) && (
        <div className="mt-4 text-[11px] opacity-70 break-all">
          현재 대기열: {queue.join(", ")}
        </div>
      )}
    </div>
  );
}
