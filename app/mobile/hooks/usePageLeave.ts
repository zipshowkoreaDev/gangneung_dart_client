"use client";

import { useEffect } from "react";
import { socket } from "@/shared/socket";
import { debugLog } from "../components/DebugOverlay";

interface UsePageLeaveProps {
  joinedQueueRef: React.MutableRefObject<boolean>;
}

// 페이지 이탈 시 대기열 정리 hook
export function usePageLeave({ joinedQueueRef }: UsePageLeaveProps): void {
  useEffect(() => {
    const emitLeaveQueue = () => {
      if (!joinedQueueRef.current) return;
      debugLog("[Queue] leave-queue emit (page hide)");
      socket.emit("leave-queue");
      joinedQueueRef.current = false;
    };

    window.addEventListener("pagehide", emitLeaveQueue);
    window.addEventListener("beforeunload", emitLeaveQueue);

    return () => {
      if (joinedQueueRef.current) {
        debugLog("[Queue] leave-queue emit (unmount)");
        socket.emit("leave-queue");
        joinedQueueRef.current = false;
      }
      window.removeEventListener("pagehide", emitLeaveQueue);
      window.removeEventListener("beforeunload", emitLeaveQueue);
    };
  }, [joinedQueueRef]);
}
