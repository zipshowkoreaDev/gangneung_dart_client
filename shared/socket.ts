import { io } from "socket.io-client";

// 소켓 서버 URL 가져오기
const getSocketUrl = () => {
  // 환경 변수에서 소켓 URL 가져오기
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }

  // 환경 변수가 없으면 기본값 사용
  // Next.js와 Socket.io가 통합되어 같은 포트에서 실행됨
  if (typeof window === "undefined") return "http://localhost:3000";

  // 브라우저에서 현재 호스트의 IP/도메인 사용 (포트 포함)
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;
  return port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
};

export const socket = io(getSocketUrl(), {
  transports: ["websocket"],
  autoConnect: false,
});
