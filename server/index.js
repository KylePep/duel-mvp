import express from "express";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { resolve } from "path";
import { type } from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = app.listen(process.env.PORT || 3000);

const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, "../client/dist")));

app.get("*", (_, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});

const rooms = new Map();

console.log("WebSocket server running on ws://localhost:3000");

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
          turn: {
            action: null,
            reaction: null
          }
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

    case "SEARCH_DUEL": {
      const openRooms = [...rooms.entries()]
        .filter(([_, room]) => room.players.length == 1) //joinable
        .map(([code]) => code);

      socket.send(JSON.stringify({
        type: "DUEL_LIST",
        rooms: openRooms
      }));
      break;
    }

    case "ACTION": {
      const room = rooms.get(socket.roomCode);
      if (!room) return;

      if (room.state.phase !== "AWAIT_ACTION") return;

      const attacker = room.state.currentTurn;
      const idx = room.players.indexOf(socket);
      if (idx !== attacker) return;

      // room.state.phase = "RESOLVE";
      room.state.turn.action = { type: msg.action };
      room.state.phase = "AWAIT_REACTION";

      //Reduce opponents hp by damage value
      room.players.forEach((p, i) =>
        p.send(
          JSON.stringify({
            type: "ACTION_SELECTED",
            waitingFor:
              i === attacker ? "Opponent reaction" : "Your Action",
            phase: room.state.phase,
          })
        )
      );

      break;
    }

    case "REACTION": {
      const room = rooms.get(socket.roomCode);
      if (!room) return;
      if (room.state.phase != "AWAIT_REACTION") return;

      const defender = 1 - room.state.currentTurn;
      const idx = room.players.indexOf(socket);
      if (idx != defender) return;

      room.state.turn.reaction = { type: msg.reaction };

      room.state.phase = "RESOLVE";
      resolveTurn(room);
      break;
    }
  }
}

function resolveTurn(room) {
  const attacker = room.state.currentTurn;
  const defender = 1 - attacker;

  let damage = 2;

  let actionType = room.state.turn.action.type;
  let reactionType = room.state.turn.reaction.type;

  if (actionType == "SLASH" && reactionType == "DODGE") damage = 0;
  if (actionType == "STAB" && reactionType == "PARRY") damage = 0;
  if (actionType == "STRIKE" && reactionType == "BLOCK") damage = 0;


  room.state.hp[defender] -= damage;

  room.players.forEach((p, i) =>
    p.send(
      JSON.stringify({
        type: "RESOLVE",
        damage,
        hp: room.state.hp,
        action: room.state.turn.action,
        reaction: room.state.turn.reaction,
        actorIndex: room.state.currentTurn,
        yourIndex: i,
      })
    )
  );

  room.state.turn.action = null;
  room.state.turn.reaction = null;

  // Game over?
  if (room.state.hp[defender] <= 0) {
    room.state.phase = "GAME_OVER";
    room.players.forEach((p, i) =>
      p.send(
        JSON.stringify({
          type: "GAME_OVER",
          youWon: i === attacker,
        })
      )
    );
    return;
  }

  // Next turn
  room.state.currentTurn = defender;
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



