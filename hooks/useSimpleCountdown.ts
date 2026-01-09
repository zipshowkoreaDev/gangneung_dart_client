import { useEffect, useRef } from "react";

interface UseSimpleCountdownProps {
  countdown: number | null;
  setCountdown: (value: number | null) => void;
  onComplete: () => void;
}

export function useSimpleCountdown({
  countdown,
  setCountdown,
  onComplete,
}: UseSimpleCountdownProps) {
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }

    if (countdown === 0) {
      setCountdown(null);
      onCompleteRef.current();
    }
  }, [countdown, setCountdown]);
}
