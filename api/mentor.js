export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(req.body),
  });

  // Stream through as SSE when the client asked for it and the upstream call
  // actually started streaming. On an upstream error (bad key, rate limit),
  // Anthropic replies with a plain JSON body even for stream:true requests,
  // so that case falls through to the normal JSON pass-through below.
  if (req.body && req.body.stream && r.ok && r.body) {
    res.status(r.status);
    res.setHeader('content-type', 'text/event-stream');
    res.setHeader('cache-control', 'no-cache');
    const reader = r.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
    return;
  }

  const data = await r.json();
  res.status(r.status).json(data);
}
