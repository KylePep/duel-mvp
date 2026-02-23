import { useEffect, useState } from "react";
import { connect, send, subscribe } from "./ws";
import Modal from "./Modal";

import './App.css';
import slashImg from "./assets/duel-slash.png";
import stabImg from "./assets/duel-stab.png";
import strikeImg from "./assets/duel-strike.png";
import dodgeImg from "./assets/duel-dodge.png";
import parryImg from "./assets/duel-parry.png";
import blockImg from "./assets/duel-block.png";

type ServerMessage = any;

export default function App() {
  const [connected, setConnected] = useState<boolean>(false);
  const [yourTurn, setYourTurn] = useState<boolean>(false);
  const [hp, setHp] = useState<number[]>([10, 10]);
  const [duelCode, setDuelCode] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>("WAITING");
  const [yourIndex, setYourIndex] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [disabledActions, setDisabledActions] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);


  type LogEntry = {
    textParts: (string | { kind: "action" | "reaction"; value: string })[];
  };

  const buildLogEntry = (
    actorIndex: number,
    resolutionType: string,
    action: string,
    reaction: string,
    attackerDamage: number,
    defenderDamage: number
  ): LogEntry => {
    const reactorIndex = actorIndex == 1 ? 2 : 1;

    switch (resolutionType) {
      case "win":
        return {
          textParts: [
            `Player ${actorIndex}'s `,
            { kind: "action", value: action },
            " beat Player ",
            `${reactorIndex}'s `,
            { kind: "reaction", value: reaction },
            ` - player ${actorIndex}: ${attackerDamage} damage, player ${reactorIndex}: ${defenderDamage} damage`
          ],
        };
      case "lose":
        return {
          textParts: [
            `Player ${actorIndex}'s `,
            { kind: "action", value: action },
            " lost to Player ",
            `${reactorIndex}'s `,
            { kind: "reaction", value: reaction },
            ` - player ${actorIndex}: ${attackerDamage} damage, player ${reactorIndex}: ${defenderDamage} damage`
          ],
        };
      case "draw":
        return {
          textParts: [
            `Player ${actorIndex}'s `,
            { kind: "action", value: action },
            " traded with Player ",
            `${reactorIndex}'s `,
            { kind: "reaction", value: reaction },
            ` - player ${actorIndex}: ${attackerDamage} damage, player ${reactorIndex}: ${defenderDamage} damage`
          ],
        };
      case "defend":
        return {
          textParts: [
            `Player ${reactorIndex}'s `,
            { kind: "reaction", value: reaction },
            " defended Player ",
            `${actorIndex}'s `,
            { kind: "action", value: action },
            ` - player ${reactorIndex}: ${defenderDamage} damage`
          ],
        };
      case "disable":
        return {
          textParts: [
            `Player ${reactorIndex}'s `,
            { kind: "reaction", value: reaction },
            " disabled Player ",
            `${actorIndex}'s `,
            { kind: "action", value: action },
            ` - player ${actorIndex} cannot use`,
            { kind: "action", value: action },
            `until the end of their next turn, player ${reactorIndex}: ${defenderDamage} damage`
          ],
        }
    }

    return { textParts: [] };
  };

  const actionImages: Record<string, string> = {
    slash: slashImg,
    stab: stabImg,
    strike: strikeImg,
  };

  const reactionImages: Record<string, string> = {
    slash: slashImg,
    stab: stabImg,
    strike: strikeImg,
    dodge: dodgeImg,
    parry: parryImg,
    block: blockImg,
  };

  const OFFENSIVE_MOVES = [
    { type: "SLASH", img: slashImg },
    { type: "STAB", img: stabImg },
    { type: "STRIKE", img: strikeImg },
  ] as const;

  const DEFENSIVE_MOVES = [
    { type: "DODGE", img: dodgeImg },
    { type: "PARRY", img: parryImg },
    { type: "BLOCK", img: blockImg },
  ] as const;

  function MoveButton({
    move,
    onClick,
    disabled,
    disabledCount,
    status,
  }: {
    move: { type: string; img: string };
    onClick: () => void;
    disabled?: boolean;
    disabledCount?: number;
    status?: string;
  }) {
    return (
      <button onClick={onClick} disabled={disabled} className={status}>
        <img
          src={move.img}
          alt={move.type}
          className={`icon ${status ? `icon--${status}` : ""}`}
        />
        {disabledCount != null && disabledCount > 0 && disabledCount}
      </button>
    );
  }


  function RenderLog({ entry }: { entry: LogEntry }) {
    return (
      <span>
        {entry.textParts.map((part, i) => {
          if (typeof part === "string") return part;

          const src =
            part.kind === "action"
              ? actionImages[part.value.toLowerCase()]
              : reactionImages[part.value.toLowerCase()];

          return (
            <img
              key={i}
              src={src}
              alt={part.value}
              className="small-icon"
            />
          );
        })}
      </span>
    );
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
          setShowModal(true);
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
        <h1 style={{ textAlign: "center" }}>Duel MVP</h1>
        <div className="action-triangle">
          <img src={slashImg} alt="slash" className="icon" /> <span>{" > "}</span>
          <img src={stabImg} alt="stab" className="icon" /> <span>{" > "}</span>
          <img src={strikeImg} alt="strike" className="icon" />
          <span>^</span> <span></span>
          <span>^</span> <span></span>
          <span>^</span>
          <img src={dodgeImg} alt="dodge" className="icon" /> <span></span>
          <img src={parryImg} alt="parry" className="icon" /> <span></span>
          <img src={blockImg} alt="block" className="icon" />
        </div>

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

        {phase === "AWAIT_REACTION" && !yourTurn && (
          <>
            <p>Offensive:</p>
            <div style={{ display: "flex", gap: "32px" }}>
              {OFFENSIVE_MOVES.map((move) => (
                <MoveButton
                  key={move.type}
                  move={move}
                  onClick={() =>
                    send({ type: "REACTION", reaction: move.type })
                  }
                  disabled={disabledActions.includes(move.type)}
                  disabledCount={countOccurrencesFilter(
                    disabledActions,
                    move.type
                  )}
                  status={disabledActions.includes(move.type) ? "disabled" : ""}
                />
              ))}
            </div>

            <p>Defensive:</p>
            <div style={{ display: "flex", gap: "32px" }}>
              {DEFENSIVE_MOVES.map((move) => (
                <MoveButton
                  key={move.type}
                  move={move}
                  onClick={() =>
                    send({ type: "REACTION", reaction: move.type })
                  }
                />
              ))}
            </div>
          </>
        )}

        {phase === "AWAIT_ACTION" && yourTurn && (
          <>
            <p>Offensive:</p>
            <div style={{ display: "flex", gap: "32px" }}>
              {OFFENSIVE_MOVES.map((move) => (
                <MoveButton
                  key={move.type}
                  move={move}
                  onClick={() =>
                    send({ type: "ACTION", action: move.type })
                  }
                  disabled={disabledActions.includes(move.type)}
                  disabledCount={countOccurrencesFilter(
                    disabledActions,
                    move.type
                  )}
                  status={disabledActions.includes(move.type) ? "disabled" : ""}
                />
              ))}
            </div>

            <p>Defensive:</p>
            <div style={{ display: "flex", gap: "32px" }}>
              {DEFENSIVE_MOVES.map((move) => (
                <MoveButton
                  key={move.type}
                  move={move}
                  onClick={() =>
                    send({ type: "REACTION", reaction: move.type })
                  }
                  disabled={true}
                  status={"stand-by"}
                />
              ))}
            </div>
          </>
        )}

        {(
          (phase === "AWAIT_REACTION" && yourTurn) ||
          (phase === "AWAIT_ACTION" && !yourTurn)
        ) && (
            <>
              <p>Offensive:</p>
              <div style={{ display: "flex", gap: "32px" }}>
                {OFFENSIVE_MOVES.map((move) => (
                  <MoveButton
                    key={move.type}
                    move={move}
                    onClick={() =>
                      send({ type: "ACTION", action: move.type })
                    }
                    disabled={true}
                    disabledCount={countOccurrencesFilter(
                      disabledActions,
                      move.type
                    )}
                    status={disabledActions.includes(move.type) ? "disabled" : "stand-by"}
                  />
                ))}
              </div>

              <p>Defensive:</p>
              <div style={{ display: "flex", gap: "32px" }}>
                {DEFENSIVE_MOVES.map((move) => (
                  <MoveButton
                    key={move.type}
                    move={move}
                    onClick={() =>
                      send({ type: "REACTION", reaction: move.type })
                    }
                    disabled={true}
                    status={"stand-by"}
                  />
                ))}
              </div>
            </>
          )}

        <div>
          {log.length > 0 && <p>Turn history:</p>}
          {log.map((entry, index) => (
            <div key={index} style={{ display: "flex", alignItems: "start", gap: "4px", marginBottom: " 4px" }}>
              <span>{index}- </span> <RenderLog entry={entry} />
            </div>
          ))}
        </div>

        <Modal
          open={showModal}
          onClose={() => setShowModal(false)}
          autoCloseMs={2500}
        >
          <h3>Turn Resolved</h3>
          <RenderLog entry={log[0]} />
        </Modal>
      </div>
    </>
  );
}
