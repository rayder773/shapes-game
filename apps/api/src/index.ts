import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3001);

const server = createServer((request, response) => {
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(
    JSON.stringify({
      ok: true,
      service: "api",
      method: request.method,
      url: request.url,
    }),
  );
});

server.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
