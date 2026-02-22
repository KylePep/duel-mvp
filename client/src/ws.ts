let socket: WebSocket | null = null;
let isConnecting = false;
const listeners = new Set<(msg: any) => void>();

export function connect() {
  if (socket || isConnecting) return;
  isConnecting = true;
  // Determine the URL based on environment
  const url =
  window.location.hostname === "localhost"
    ? "ws://localhost:3000"
    : "wss://duel-mvp.onrender.com";
    
  socket = new WebSocket(url);

  socket.onopen = () => {
    isConnecting = false;
    console.log("Connected to", url);
    socket?.send(JSON.stringify({ type: "CONNECT" }));
  };

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    listeners.forEach((fn) => fn(msg));
  };

  socket.onclose = () => {
    socket = null;
    isConnecting = false;
  };
}

export function send(msg: any) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(msg));
}

export function subscribe(fn: (msg:any) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
