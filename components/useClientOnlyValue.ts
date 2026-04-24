/** On native there is no SSR, so the “client” value is always the right one. */
export function useClientOnlyValue<S, C>(server: S, client: C): S | C {
  return client;
}
