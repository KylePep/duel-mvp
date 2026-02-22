let socket: WebSocket | null = null;
let isConnecting = false;
const listeners = new Set<(msg: any) => void>();

export function connect() {
  if (socket || isConnecting) return;
  isConnecting = true;
  socket = new WebSocket("ws://localhost:3000");

  socket.onopen = () => {
    isConnecting = false;
    console.log("Connected");
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
