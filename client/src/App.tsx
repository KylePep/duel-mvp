import { useEffect, useState } from "react";
import { connect, send, subscribe } from "./ws";

type ServerMessage = any;

export default function App() {
  const [connected, setConnected] = useState<boolean>(false);
  const [yourTurn, setYourTurn] = useState<boolean>(false);
  const [hp, setHp] = useState<number[]>([10, 10]);
  const [duelCode, setDuelCode] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>("WAITING");
  const [yourIndex, setYourIndex] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("");
  const [log, setLog] = useState<string[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);

  useEffect(() => {
    connect();

    const unsub = subscribe((msg: ServerMessage) => {
      console.log("MSG", msg);

      switch (msg.type) {
        case "CONNECTED": 
          setConnected(true); 
          break;
        case "DUEL_CREATED":
          setDuelCode(msg.code);
          break;

        case "DUEL_STARTED":
          setYourIndex(msg.yourIndex);
          setPhase(msg.phase);
          setRooms([]);
          setLog([]);
          break;

        case "PHASE_UPDATE":
          setPhase(msg.phase);
          break;

        case "TURN_START":
          setYourTurn(msg.yourTurn);
          setStatus("");
          break;

        case "ACTION_SELECTED":
          setPhase(msg.phase);
          setStatus(msg.waitingFor);
          break;
          
        case "RESOLVE":
          setHp(msg.hp);
          if (msg.damage > 0){
            setLog(prevLogs => [`${prevLogs.length + 1} - ${msg.actorIndex == msg.yourIndex ? "Your" : "Opponent's"} ${msg.action.type} was successful (${msg.damage} damage dealt)`, ...prevLogs ]);
          } else {
            setLog(prevLogs => [`${prevLogs.length + 1} - ${msg.actorIndex == msg.yourIndex ? "Opponent's" : "Your"} ${msg.reaction.type} prevented ${msg.actorIndex == msg.yourIndex ? "Your" : "Opponent's"} ${msg.action.type} (${msg.damage} damage dealt)`, ...prevLogs ]);
          }
          break;

        case "GAME_OVER":
          alert(msg.youWon ? "You win!" : "You lose!");
          setPhase("WAITING");
          setYourIndex(null);
          setDuelCode(null);
          setHp([10,10])
          break;

        case "DUEL_LIST":
          setRooms(msg.rooms);
      }
    });

    return () => { unsub(); }; // ensure return is void
  }, []);

  return (
    <>
    <div style={{ padding: 20, maxWidth: 400 }}>
      <h1>Duel MVP</h1>

      {!connected && <p>Connecting…</p>}

      {connected && !duelCode && yourIndex == null && (
        <>
          <button onClick={() => send({ type: "CREATE_DUEL" })}>
            Create Duel
          </button>
          <button
            onClick={() =>
              send({
                type: "JOIN_DUEL",
                code: prompt("Enter duel code"),
              })
            }
            >
            Join Duel
          </button>
          <button
            onClick={() => send({type: "SEARCH_DUEL"})}>
            Search Duel
          </button>
        </>
      )}

      {duelCode && yourIndex == null && (
        <p>
          <strong>Duel Code:</strong> {duelCode}
        </p>
      )}

      {connected && phase != "WAITING" && (
        <p>
          <strong>In a battle</strong>
        </p>
      )}

<div>
      {rooms.length > 0 && (
        <>
        <p>Available Duels:</p> 
        {rooms.map((room, index) => (
        <div key={index} style={{display: "flex", gap:"32px"} }>
          <p >{room}</p> <button
            onClick={() =>
              send({
                type: "JOIN_DUEL",
                code: room,
              })
            }
            >JOIN</button>
        </div>
      ))} 
      </>
      )
    }
    </div>

      <hr />

      <p>
        <strong>Phase:</strong> {phase}
      </p>
      {status && (
        <p>
          <em>{status}</em>
        </p>
      )}

      {yourIndex != null &&(
        <p>
          <strong>Turn:</strong>{" "}
          {yourTurn ? "Yours" : "Opponent"}
        </p>
      )}

    {yourIndex !== null && (
      <>
        <p>
          <strong>Your HP:</strong> {hp[yourIndex]}
        </p>
        <p>
          <strong>Opponent HP:</strong> {hp[1 - yourIndex]}
        </p>
      </>
    )}

    {phase === "AWAIT_REACTION" && !yourTurn && (
      <>
        <p>Choose your reaction:</p>
        <button onClick={() => send({ type: "REACTION", reaction: "DODGE" })}>
          DODGE
        </button>
        <button onClick={() => send({ type: "REACTION", reaction: "PARRY" })}>
          PARRY
        </button>
        <button onClick={() => send({ type: "REACTION", reaction: "BLOCK" })}>
          Block
        </button>
      </>
    )}

    {phase === "AWAIT_ACTION" && yourTurn && (
      <>
    <button
    onClick={() => send({ type: "ACTION", action: "SLASH" })}
    disabled={
          !yourTurn || phase !== "AWAIT_ACTION"
        }
        >
        SLASH
      </button>
      <button
        onClick={() => send({ type: "ACTION", action: "STAB" })}
        disabled={
          !yourTurn || phase !== "AWAIT_ACTION"
        }
        >
        STAB
      </button>
      <button
        onClick={() => send({ type: "ACTION", action: "STRIKE" })}
        disabled={
          !yourTurn || phase !== "AWAIT_ACTION"
        }
        >
        STRIKE
      </button>
          </>
      )}

    </div>
    <div>
      {log.length >0 && <p>LOG:</p> }
      {log.map((logItem, index) => (
        <p key={index}>{logItem}</p>
      ))}
    </div>
      </>
  );
}
