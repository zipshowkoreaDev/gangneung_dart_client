// QR 스캔 없이 직접 접속 시 접근 제한 화면
export default function AccessDenied() {
  return (
    <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl">
      <div className="flex flex-col items-center gap-6">
        <div className="w-20 h-20 bg-orange-500/20 border-4 border-orange-500 rounded-full flex items-center justify-center">
          <svg
            className="w-12 h-12 text-orange-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <div className="text-white text-2xl font-bold text-center">
          접근 제한
        </div>
        <div className="text-white/80 text-base text-center leading-relaxed">
          이 체험은 현장에서만 이용 가능합니다.
        </div>
        <div className="mt-2 p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="text-white/70 text-sm text-center leading-relaxed">
            현장에 비치된{" "}
            <span className="font-bold text-yellow-300">QR 코드</span>를
            스캔하여
            <br />
            체험을 시작해주세요.
          </div>
        </div>
        <div className="mt-4 text-white/50 text-xs text-center">
          현장 한정 인터랙티브 체험
        </div>
      </div>
    </div>
  );
}
