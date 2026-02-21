let socket;
let isConnecting = false;
const listeners = new Set();

export function connect() {
  if (socket || isConnecting) return;
  isConnecting = true;
  socket = new WebSocket("ws://localhost:8080");

  socket.onopen = () => {
    isConnecting = false;
    console.log("Connected");
    socket.send(JSON.stringify({ type: "CONNECT" }));
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

export function send(msg) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(msg));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
