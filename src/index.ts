import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { createDrones, stepDrones, telemetry } from "./drones";

const PORT = 3001;
const TICK_MS = 50;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ["http://localhost:3000", "https://www.v12h.com", "https://v12h.com"] },
});

const drones = createDrones();

app.get("/health", (_req, res) => {
  res.json({ ok: true, drones: drones.length });
});

io.on("connection", (socket) => {
  socket.emit("telemetry", telemetry(drones));
});

setInterval(() => {
  stepDrones(drones, TICK_MS / 1000);
  io.emit("telemetry", telemetry(drones));
}, TICK_MS);

httpServer.listen(PORT, () => {
  console.log(`telemetry on http://localhost:${PORT}`);
});
