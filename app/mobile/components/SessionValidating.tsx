// 세션 검증 중 로딩 화면
export default function SessionValidating() {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      <div className="mt-6 text-white text-lg">세션 확인 중...</div>
    </div>
  );
}
