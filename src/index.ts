import { config } from "dotenv";
import express from "express";
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { createDrones, stepDrones, telemetry } from "./drones";

config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env") });

const PORT = 3001;
const TICK_MS = 50;
const TOKEN = process.env.TELEMETRY_TOKEN;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ["http://localhost:3000", "https://www.v12h.com", "https://v12h.com"] },
});

function tokenMatches(provided: unknown) {
  if (!TOKEN || typeof provided !== "string") return false;
  const given = Buffer.from(provided);
  const expected = Buffer.from(TOKEN);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

io.use((socket, next) => {
  if (tokenMatches(socket.handshake.auth?.token)) {
    next();
    return;
  }
  next(new Error("unauthorized"));
});

if (!TOKEN) {
  console.warn("TELEMETRY_TOKEN is not set; websocket connections will be rejected");
}

const drones = createDrones();

app.get("/health", (_req, res) => {
  res.json({ ok: true, drones: drones.length });
});

io.on("connection", (socket) => {
  socket.emit("telemetry", telemetry(drones));
  socket.on("latency", (ack: () => void) => {
    ack();
  });
});

setInterval(() => {
  stepDrones(drones, TICK_MS / 1000);
  io.emit("telemetry", telemetry(drones));
}, TICK_MS);

httpServer.listen(PORT, () => {
  console.log(`telemetry on http://localhost:${PORT}`);
});
