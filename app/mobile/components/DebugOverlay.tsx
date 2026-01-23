"use client";

import { useState, useEffect, useCallback } from "react";

interface LogEntry {
  id: number;
  time: string;
  message: string;
}

let logId = 0;
const logListeners: ((entry: LogEntry) => void)[] = [];

// 전역 로그 함수
export function debugLog(message: string) {
  const entry: LogEntry = {
    id: logId++,
    time: new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    message,
  };

  // 리스너들에게 알림
  logListeners.forEach((listener) => listener(entry));
}

export default function DebugOverlay() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [...prev.slice(-30), entry]); // 최근 30개만 유지
  }, []);

  useEffect(() => {
    logListeners.push(addLog);
    return () => {
      const idx = logListeners.indexOf(addLog);
      if (idx >= 0) logListeners.splice(idx, 1);
    };
  }, [addLog]);

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed top-2 right-2 z-50 bg-black/80 text-white text-xs px-2 py-1 rounded"
      >
        로그 ({logs.length})
      </button>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 text-white text-[10px] max-h-[40vh] overflow-y-auto">
      <div className="sticky top-0 bg-black flex justify-between items-center px-2 py-1 border-b border-white/20">
        <span className="font-bold">DEBUG LOG</span>
        <div className="flex gap-2">
          <button
            onClick={() => setLogs([])}
            className="bg-red-600 px-2 py-0.5 rounded text-[9px]"
          >
            Clear
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="bg-gray-600 px-2 py-0.5 rounded text-[9px]"
          >
            최소화
          </button>
        </div>
      </div>
      <div className="p-2 space-y-1">
        {logs.length === 0 && (
          <div className="text-white/50">로그가 없습니다...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="font-mono">
            <span className="text-blue-400">[{log.time}]</span>{" "}
            <span className="text-green-300">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
