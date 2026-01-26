"use client";

type LevelCheckOverlayProps = {
  sample: { beta: number; gamma: number } | null;
  threshold: number;
  onCancel: () => void;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export default function LevelCheckOverlay({
  sample,
  threshold,
  onCancel,
}: LevelCheckOverlayProps) {
  const beta = sample?.beta ?? 0;
  const gamma = sample?.gamma ?? 0;
  const x = clamp(gamma / threshold, -1, 1);
  const y = clamp(beta / threshold, -1, 1);
  const isLevel = Math.abs(beta) <= threshold && Math.abs(gamma) <= threshold;

  const radius = 70;
  const bubbleX = x * radius;
  const bubbleY = y * radius;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-[320px] rounded-3xl bg-white/10 p-6 text-center text-white backdrop-blur-md">
        <div className="text-xl font-bold">수평 맞추는 중</div>
        <div className="mt-2 text-sm text-white/80">
          기기를 평평하게 두면 자동으로 진행돼요
        </div>

        <div className="mt-6 flex items-center justify-center">
          <div className="relative h-[200px] w-[200px] rounded-full border border-white/40 bg-white/5">
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
            <div
              className={`absolute left-1/2 top-1/2 h-6 w-6 rounded-full shadow-md transition-transform ${
                isLevel ? "bg-green-400" : "bg-yellow-300"
              }`}
              style={{
                transform: `translate(calc(-50% + ${bubbleX}px), calc(-50% + ${bubbleY}px))`,
              }}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center">
          <div className="relative h-16 w-16">
            <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-white/10" />
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
            <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-300/90 level-bubble" />
          </div>
        </div>

        <div
          className={`mt-4 text-sm ${
            isLevel ? "text-green-300" : "text-white/70"
          }`}
        >
          {isLevel ? "맞았어요!" : `허용 범위 ±${threshold}°`}
        </div>
        <div className="mt-1 text-xs text-white/60">
          {sample
            ? `현재: 좌우 ${gamma.toFixed(1)}°, 앞뒤 ${beta.toFixed(1)}°`
            : "센서 값 수신 중..."}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-5 w-full rounded-xl border border-white/30 bg-white/10 py-3 text-sm text-white/80 transition hover:bg-white/20"
        >
          취소
        </button>
      </div>
    </div>
  );
}
