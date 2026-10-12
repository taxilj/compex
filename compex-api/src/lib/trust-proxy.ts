// 0 -> false (never read X-Forwarded-For); n -> trust exactly n hops nearest the socket.
export function trustProxySetting(hops: number): number | false {
  return hops > 0 ? hops : false;
}
