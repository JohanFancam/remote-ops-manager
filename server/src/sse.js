const clients = new Set();

export function subscribe(res, filter = {}) {
  const client = { res, filter };
  clients.add(client);
  res.on('close', () => clients.delete(client));
  return client;
}

export function broadcast(event, data, filterMatch = () => true) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    if (!filterMatch(client.filter)) continue;
    try {
      client.res.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

export function broadcastToday(date, event, data) {
  broadcast(event, data, (filter) => !filter.date || filter.date === date);
}
