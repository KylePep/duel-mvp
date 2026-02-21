import { WebSocketServer } from "ws";
import crypto from "crypto";

const wss = new WebSocketServer({ port: 8080 });
const rooms = new Map();

console.log("WebSocket server running on ws://localhost:8080");

wss.on("connection", (socket) => {
  socket.id = crypto.randomUUID();

  socket.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    handleMessage(socket, msg);
  });

  socket.on("close", () => {
    handleDisconnect(socket);
  });
});

function handleMessage(socket, msg) {
  switch (msg.type) {
    case "CONNECT": {
      socket.send(JSON.stringify({ type: "CONNECTED" }));
      break;
    }

    case "CREATE_DUEL": {
      const code = Math.random().toString(36).substring(2, 6).toUpperCase();

      rooms.set(code, {
        code,
        players: [socket],
        state: {
          phase: "WAITING",
          currentTurn: 0,
          hp: [10, 10],
        }
      });

      socket.roomCode = code;
      socket.send(JSON.stringify({ type: "DUEL_CREATED", code }));
      socket.send(
        JSON.stringify({
          type: "PHASE_UPDATE",
          phase: "WAITING",
        })
      );
      break;
    }

    case "JOIN_DUEL": {
      const room = rooms.get(msg.code);
      if (!room || room.players.length >= 2) {
        socket.send(JSON.stringify({ type: "ERROR", message: "Invalid room" }));
        return;
      }

      room.players.push(socket);
      socket.roomCode = msg.code;

      room.state.currentTurn = Math.floor(Math.random() * 2);
      room.state.phase = "TURN_START";

      // Notify both players duel has started
      room.players.forEach((p, i) =>
        p.send(
          JSON.stringify({
            type: "DUEL_STARTED",
            yourIndex: i,
            phase: room.state.phase,
          })
        ));

      // Announce first turn
      room.players.forEach((p, i) =>
        p.send(
          JSON.stringify({
            type: "TURN_START",
            yourTurn: room.state.currentTurn === i,
          })
        )
      );

      // Move to action phase
      room.state.phase = "AWAIT_ACTION";
      room.players.forEach((p) =>
        p.send(
          JSON.stringify({
            type: "PHASE_UPDATE",
            phase: "AWAIT_ACTION",
          })
        )
      );

      break;
    }

    case "ATTACK": {
      const room = rooms.get(socket.roomCode);
      if (!room) return;

      if (room.state.phase !== "AWAIT_ACTION") return;

      const idx = room.players.indexOf(socket);
      if (idx !== room.state.currentTurn) return;

      room.state.phase = "RESOLVE";

      const opponent = 1 - idx;
      room.state.hp[opponent] -= Math.floor(Math.random() * 3) + 1;
      ;

      //Reduce opponents hp by damage value
      room.players.forEach((p, i) =>
        p.send(
          JSON.stringify({
            type: "RESOLVE",
            hp: room.state.hp,
          })
        )
      );

      // Check win
      if (room.state.hp[opponent] <= 0) {
        room.state.phase = "GAME_OVER";
        room.players.forEach((p, i) =>
          p.send(
            JSON.stringify({
              type: "GAME_OVER",
              winner: idx,
              youWon: i === idx,
            })
          )
        );
        return;
      }

      // Swap turn
      room.state.currentTurn = opponent;
      room.state.phase = "TURN_START";

      room.players.forEach((p, i) =>
        p.send(
          JSON.stringify({
            type: "TURN_START",
            yourTurn: room.state.currentTurn === i,
          })
        )
      );

      room.state.phase = "AWAIT_ACTION";
      room.players.forEach((p) =>
        p.send(
          JSON.stringify({
            type: "PHASE_UPDATE",
            phase: "AWAIT_ACTION",
          })
        )
      );

      break;
    }
  }
}

function handleDisconnect(socket) {
  console.log("Disconnected:", socket.id);

  if (!socket.roomCode) return;

  const room = rooms.get(socket.roomCode);
  if (!room) return;

  room.players = room.players.filter((p) => p !== socket);

  if (room.players.length === 0) {
    rooms.delete(socket.roomCode);
  }
}



