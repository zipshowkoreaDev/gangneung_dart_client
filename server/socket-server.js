import { createServer } from "http";
import { Server } from "socket.io";

// HTTP 서버 생성
const httpServer = createServer();

// Socket.io 서버 설정
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
  serveClient: false,
  path: "/socket.io/",
});

io.on("connection", (socket) => {
  console.log("✅ connected:", socket.id);

  socket.on("join-room", ({ room }) => {
    socket.join(room);
    console.log(`🚪 join room: ${room} (socket: ${socket.id})`);
  });

  socket.on("aim-update", (data) => {
    console.log(`🎯 aim-update from ${data.name || data.playerId} in room ${data.room}:`, data.aim);
    socket.to(data.room).emit("aim-update", data);
  });

  socket.on("aim-off", (data) => {
    console.log(`❌ aim-off from ${data.name || data.playerId} in room ${data.room}`);
    socket.to(data.room).emit("aim-off", data);
  });

  socket.on("throw", (data) => {
    console.log(`🎲 throw from ${data.name || data.playerId} in room ${data.room}`);
    socket.to(data.room).emit("throw", data);
  });

  socket.on("disconnect", () => {
    console.log("❌ disconnected:", socket.id);
  });
});

// 모든 네트워크 인터페이스(0.0.0.0)에서 수신
httpServer.listen(3001, "0.0.0.0", () => {
  console.log("Socket server running on 0.0.0.0:3001");
  console.log("Accessible from network at ws://192.168.0.157:3001");
});
