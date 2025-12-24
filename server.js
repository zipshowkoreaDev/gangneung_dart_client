import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

// Next.js 앱 초기화 (Turbopack 비활성화)
const app = next({
  dev,
  hostname,
  port,
  turbo: false, // Turbopack 비활성화
  customServer: true, // 커스텀 서버 사용
});
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);

      // favicon 요청 처리 (404 에러 방지)
      if (req.url === "/favicon.ico") {
        res.writeHead(204); // No Content
        res.end();
        return;
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // Socket.io 서버 설정
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
    path: "/socket.io/",
    pingTimeout: 60000, // 60초
    pingInterval: 25000, // 25초
  });

  io.on("connection", (socket) => {
    console.log("✅ connected:", socket.id);

    socket.on("join-room", ({ room }) => {
      socket.join(room);
      console.log(`🚪 join room: ${room} (socket: ${socket.id})`);
    });

    socket.on("aim-update", (data) => {
      console.log(
        `🎯 aim-update from ${data.name || data.playerId} in room ${
          data.room
        }:`,
        data.aim
      );
      socket.to(data.room).emit("aim-update", data);
    });

    socket.on("aim-off", (data) => {
      console.log(
        `❌ aim-off from ${data.name || data.playerId} in room ${data.room}`
      );
      socket.to(data.room).emit("aim-off", data);
    });

    socket.on("throw", (data) => {
      console.log(
        `🎲 throw from ${data.name || data.playerId} in room ${data.room}`
      );
      socket.to(data.room).emit("throw", data);
    });

    socket.on("disconnect", () => {
      console.log("❌ disconnected:", socket.id);
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.io server ready on the same port`);
    });
});
