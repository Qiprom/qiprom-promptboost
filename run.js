import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { input } = req.body || {};
  if (!input) {
    return res.status(400).json({ error: 'Missing input' });
  }

  res.json({ output: `Boost-Echo: ${input}` });
}
