// Same-origin communication with the authoritative Python server.
export async function api(path, body) {
  // Send actions as POST + JSON; reading state without a body uses GET.
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : {"Content-Type": "application/json"},
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  // Decode Python's JSON response into the JavaScript object used by accept().
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not reach the game server.");
  return data;
}
