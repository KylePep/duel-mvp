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
  const [disabledActions, setDisabledActions] = useState<string[]>([]);

  const buildLogEntry = (actorIndex: number, resolutionType: string, action: string, reaction: string, attackerDamage: number, defenderDamage: number): string => {
    let logEntry = "";
    const reactorIndex = actorIndex == 0 ? 2 : 1;
    switch (resolutionType) {
      case "win":
        logEntry = `Player ${actorIndex}'s ${action} Beat Player ${reactorIndex}'s ${reaction} - player ${actorIndex}: ${attackerDamage} damage, player ${reactorIndex}: ${defenderDamage} damage`;
        break;
      case "lose":
        logEntry = `Player ${actorIndex}'s ${action} Lost to Player ${reactorIndex}'s ${reaction} - player ${actorIndex}: ${attackerDamage} damage, player ${reactorIndex}: ${defenderDamage} damage`;
        break;
      case "draw":
        logEntry = `Player ${actorIndex}'s ${action} traded with Player ${reactorIndex}'s ${reaction} - player ${actorIndex}: ${attackerDamage} damage, player ${reactorIndex}: ${defenderDamage} damage`;
        break;
      case "defend":
        logEntry = `Player ${reactorIndex}'s ${reaction} defended Player ${actorIndex}'s ${action} - player ${reactorIndex}: ${defenderDamage} damage`;
        break;
      case "disable":
        logEntry = `Player ${reactorIndex}'s ${reaction} disabled Player ${actorIndex}'s ${action} - player ${actorIndex} cannot use ${action} until the end of their next turn, player ${reactorIndex}: ${defenderDamage} damage`;
        break;
    }
    return logEntry;
  }


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
          setDisabledActions(msg.disabledActions[msg.yourIndex]);
          setLog(prevLogs => [buildLogEntry(msg.actorIndex + 1, msg.resolutionType, msg.action.type, msg.reaction.type, msg.attackerDamage, msg.defenderDamage), ...prevLogs]);
          break;

        case "GAME_OVER":
          alert(msg.youWon ? "You win!" : "You lose!");
          setPhase("WAITING");
          setYourIndex(null);
          setDuelCode(null);
          setHp([10, 10])
          break;

        case "DUEL_LIST":
          setRooms(msg.rooms);
      }
    });

    return () => { unsub(); }; // ensure return is void
  }, []);


  const countOccurrencesFilter = (arr: string[], val: string): number => {
    return arr.filter(v => v === val).length;
  }

  return (
    <>
      <div style={{ padding: 20 }}>
        <h1>Duel MVP</h1>

        {!connected && <p>Connecting…</p>}

        {connected && !duelCode && yourIndex == null && (
          <div style={{ display: "flex", gap: "8px" }}>
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
              onClick={() => send({ type: "SEARCH_DUEL" })}>
              Search Duel
            </button>
          </div>
        )}

        {duelCode && yourIndex == null && (
          <p>
            <strong>Duel Code:</strong> {duelCode}
          </p>
        )}

        {connected && phase != "WAITING" && (
          <p>
            {/* <strong>In a battle</strong> */}
            <strong>PLAYER {yourIndex != null ? yourIndex + 1 : 0}</strong>
          </p>
        )}

        <div>
          {rooms.length > 0 && (
            <>
              <p>Available Duels:</p>
              {rooms.map((room, index) => (
                <div key={index} style={{ display: "flex", gap: "32px" }}>
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

        {yourIndex !== null && (
          <>
            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <strong>PLAYER {yourIndex + 1} HP: {hp[yourIndex]}</strong>
                <div
                  style={{
                    width: "100%",
                    height: "20px",
                    background: "#ccc",
                    borderRadius: "4px",
                    overflow: "hidden",
                    marginTop: "4px",
                  }}
                >
                  <div
                    style={{
                      width: `${(hp[yourIndex] / 10) * 100}%`,
                      height: "100%",
                      background: "green",
                      transition: "width 0.3s",
                    }}
                  ></div>
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <strong>Player {yourIndex == 1 ? 1 : 2} HP: {hp[1 - yourIndex]}</strong>
                <div
                  style={{
                    width: "100%",
                    height: "20px",
                    background: "#ccc",
                    borderRadius: "4px",
                    overflow: "hidden",
                    marginTop: "4px",
                  }}
                >
                  <div
                    style={{
                      width: `${(hp[1 - yourIndex] / 10) * 100}%`,
                      height: "100%",
                      background: "red",
                      transition: "width 0.3s",
                    }}
                  ></div>
                </div>
              </div>
            </div>

            <p>
              <strong>{yourTurn ? "Your Turn" : "Opponent's Turn"}</strong>

            </p>
          </>
        )}

        {status && (
          <p>
            <em>{status}</em>
          </p>
        )}

        <div>
          {disabledActions.length > 0 && <p>Disabled Actions:</p>}
          {disabledActions.map((disabledAction, index) => (
            <p key={index}>{disabledAction}</p>
          ))}
        </div>

        {phase === "AWAIT_REACTION" && !yourTurn && (
          <>
            <p>Choose your reaction:</p>
            <p>Offensive:</p>
            <div style={{ display: "flex", gap: "32px" }}>
              <button onClick={() => send({ type: "REACTION", reaction: "SLASH" })}
                disabled={disabledActions.includes("SLASH")}>
                SLASH {disabledActions.includes("SLASH") && <>{countOccurrencesFilter(disabledActions, "SLASH")}</>}
              </button>
              <button onClick={() => send({ type: "REACTION", reaction: "STAB" })}
                disabled={disabledActions.includes("STAB")}>
                STAB {disabledActions.includes("STAB") && <>{countOccurrencesFilter(disabledActions, "STAB")}</>}
              </button>
              <button onClick={() => send({ type: "REACTION", reaction: "STRIKE" })}
                disabled={disabledActions.includes("STRIKE")}>
                STRIKE {disabledActions.includes("STRIKE") && <>{countOccurrencesFilter(disabledActions, "STRIKE")}</>}
              </button>
            </div>
            <p>Defensive:</p>
            <div style={{ display: "flex", gap: "32px" }}>
              <button onClick={() => send({ type: "REACTION", reaction: "DODGE" })}>
                DODGE
              </button>
              <button onClick={() => send({ type: "REACTION", reaction: "PARRY" })}>
                PARRY
              </button>
              <button onClick={() => send({ type: "REACTION", reaction: "BLOCK" })}>
                Block
              </button>
            </div>
          </>
        )}



        {phase === "AWAIT_ACTION" && yourTurn && (
          <>
            <p>Choose your action:</p>
            <div style={{ display: "flex", gap: "32px" }}>
              <button onClick={() => send({ type: "ACTION", action: "SLASH" })}
                disabled={disabledActions.includes("SLASH")}>
                SLASH {disabledActions.includes("SLASH") && <>{countOccurrencesFilter(disabledActions, "SLASH")}</>}
              </button>
              <button onClick={() => send({ type: "ACTION", action: "STAB" })}
                disabled={disabledActions.includes("STAB")}>
                STAB {disabledActions.includes("STAB") && <>{countOccurrencesFilter(disabledActions, "STAB")}</>}
              </button>
              <button onClick={() => send({ type: "ACTION", action: "STRIKE" })}
                disabled={disabledActions.includes("STRIKE")}>
                STRIKE {disabledActions.includes("STRIKE") && <>{countOccurrencesFilter(disabledActions, "STRIKE")}</>}
              </button>
            </div>
          </>
        )}
        <div>
          {log.length > 0 && <p>LOG:</p>}
          {log.map((logItem, index) => (
            <p key={index}>{logItem}</p>
          ))}
        </div>
      </div>
    </>
  );
}
