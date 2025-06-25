import { createServer } from "node:http";

const PORT = process.env.PORT || 8888;

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  if (url.pathname === "/") {
    console.log("Root path accessed");
    res.writeHead(200);
    res.end("こんにちは！");
  } else if (url.pathname === "/ask" && url.searchParams.has("q")) {
    const question = url.searchParams.get("q");
    console.log("/ask path accessed with q=", question);
    res.writeHead(200);
    res.end(`Your question is '${question}'`);
  } else {
    console.log("Unknown path:", url.pathname);
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
