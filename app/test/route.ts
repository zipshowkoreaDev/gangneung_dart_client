import { readFile } from "fs/promises";
import path from "path";

export async function GET() {
  const filePath = path.join(process.cwd(), "01_socket_test_script.html");
  const html = await readFile(filePath, "utf8");

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}
