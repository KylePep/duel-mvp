import { useEffect, useState } from "react";
import { connect, send, subscribe } from "./ws";

export default function App() {
  const [connected, setConnected] = useState(false);
  const [yourTurn, setYourTurn] = useState(false);
  const [hp, setHp] = useState([10, 10]);
  const [duelCode, setDuelCode] = useState(null);
  const [phase, setPhase] = useState("WAITING");
  const [yourIndex, setYourIndex] = useState(null);

  useEffect(() => {
    connect();
    setConnected(true);

    const unsub = subscribe((msg) => {
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
          break;

        case "PHASE_UPDATE":
          setPhase(msg.phase);
          break;

        case "TURN_START":
          setYourTurn(msg.yourTurn);
          break;

        case "RESOLVE":
          setHp(msg.hp);
          break;

        case "GAME_OVER":
          alert(msg.youWon ? "You win!" : "You lose!");
          setPhase("WAITING");
          setYourIndex(null);
          setDuelCode(null);
          setHp([10,10])
          break;
      }
    });

    return unsub;
  }, []);

  const opponentIndex =
    yourIndex !== null ? 1 - yourIndex : null;

  return (
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

      <hr />

      <p>
        <strong>Phase:</strong> {phase}
      </p>

      {yourIndex != null &&(
        <p>
          <strong>Turn:</strong>{" "}
          {yourTurn ? "Yours" : "Opponent"}
        </p>
      )}

      {yourIndex !== null && (
        <>
          <p>
            <strong>Your HP:</strong>{" "}
            {hp[yourIndex]}
          </p>
          <p>
            <strong>Opponent HP:</strong>{" "}
            {hp[opponentIndex]}
          </p>
        </>
      )}

      <button
        onClick={() => send({ type: "ATTACK" })}
        disabled={
          !yourTurn || phase !== "AWAIT_ACTION"
        }
      >
        Attack
      </button>
    </div>
  );
}
