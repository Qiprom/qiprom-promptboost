export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Body sicher einlesen (ohne Framework)
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    try {
      const json = JSON.parse(body || '{}');
      const input = json?.input;
      if (!input) return res.status(400).json({ error: 'Missing input' });
      return res.status(200).json({ output: `Boost-Echo: ${input}` });
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  });
}
