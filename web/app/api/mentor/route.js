export async function POST(request) {
  const body = await request.json();

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  // Stream through as SSE when the client asked for it and the upstream call
  // actually started streaming. On an upstream error (bad key, rate limit),
  // Anthropic replies with a plain JSON body even for stream:true requests,
  // so that case falls through to the normal JSON pass-through below.
  if (body && body.stream && r.ok && r.body) {
    return new Response(r.body, {
      status: r.status,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      },
    });
  }

  const data = await r.json();
  return Response.json(data, { status: r.status });
}
