import { useEffect, useState } from "react";
import { connect, send, subscribe } from "./ws";

export default function App() {
  const [connected, setConnected] = useState(false);
  const [yourTurn, setYourTurn] = useState(false);
  const [hp, setHp] = useState([10, 10]);
  const [duelCode, setDuelCode] = useState(null);

  useEffect(() => {
    connect();

    const unsub = subscribe((msg) => {
      console.log("MSG", msg);

      switch (msg.type) {
        case "CONNECTED":
          setConnected(true);
          break;

        case "DUEL_CREATED":
          setDuelCode(msg.code);
          break;

        case "TURN_START":
          setYourTurn(msg.yourTurn);
          break;

        case "RESOLVE":
          setHp(msg.hp);
          break;
      }
    });

    return unsub;
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Duel MVP</h1>

      {!connected && <p>Connecting...</p>}

      {connected && !duelCode && (
        <>
          <button onClick={() => send({ type: "CREATE_DUEL" })}>
            Create Duel
          </button>
          <button
            onClick={() =>
              send({ type: "JOIN_DUEL", code: prompt("Enter duel code") })
            }
          >
            Join Duel
          </button>
        </>
      )}

      {duelCode && <p>Duel Code: {duelCode}</p>}

      <hr />

      <p>
        <strong>Status:</strong>{" "}
        {yourTurn ? "Your Turn" : "Opponent's Turn"}
      </p>

      <p>
        <strong>HOST HP:</strong> {hp[0]} 
      </p>
      <p>
        <strong>OTHER HP:</strong> {hp[1]}
      </p>

      <button
        onClick={() => send({ type: "ATTACK" })}
        disabled={!yourTurn}
      >
        Attack
      </button>
    </div>
  );
}
