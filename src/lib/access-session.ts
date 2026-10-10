let allowed = false;
let deadline = 0;
let requests: AbortController | undefined;
export function updateExplorationAccess(next: boolean, expires = Infinity) {
  allowed = next; deadline = expires;
  if (!next) requests?.abort();
  else if (!requests || requests.signal.aborted) requests = new AbortController();
}
export function explorationSignal() {
  if (!allowed || Date.now() >= deadline) {
    updateExplorationAccess(false);
    throw new Error("Your access has ended. Subscribe to continue.");
  }
  if (!requests) requests = new AbortController();
  return requests.signal;
}