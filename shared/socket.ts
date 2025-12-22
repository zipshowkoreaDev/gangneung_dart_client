import { io } from "socket.io-client";

// 클라이언트가 접속한 호스트로 소켓 서버 연결
const getSocketUrl = () => {
  if (typeof window === "undefined") return "http://localhost:3001";

  // 브라우저에서 현재 호스트의 IP/도메인 사용
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:3001`;
};

export const socket = io(getSocketUrl(), {
  transports: ["websocket"],
  autoConnect: false,
});
