// 0 -> false (never read X-Forwarded-For); n -> trust exactly n hops nearest the socket.
export function trustProxySetting(hops: number): false | ((address: string, index: number) => boolean) {
  return hops > 0 ? (_address, index) => index < hops : false;
}
