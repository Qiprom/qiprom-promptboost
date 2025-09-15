export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  let body = '';
  req.on('data', chunk => (body += chunk));
  req.on('end', () => {
    try {
      const { input } = JSON.parse(body || '{}');
      if (!input) return res.status(400).json({ error: 'Missing input' });
      res.json({ output: `Boost-Echo: ${input}` });
    } catch {
      res.status(400).json({ error: 'Invalid JSON' });
    }
  });
}
