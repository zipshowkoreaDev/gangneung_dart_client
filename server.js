import { createServer } from "http";
import { parse } from "url";
import next from "next";

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

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
