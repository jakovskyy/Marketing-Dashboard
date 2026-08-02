// Vercel serverless function: speaks the dashboard briefing in the ElevenLabs voice.
//
// The webpage sends the briefing text to this function. The function calls
// ElevenLabs with your private API key (read from an environment variable,
// never from the page) and streams the audio back. Vercel's CDN caches the
// result by URL, so the same briefing is only generated once until the text
// changes.
//
// Set these in Vercel -> Project Settings -> Environment Variables:
//   ELEVENLABS_API_KEY   (required) your ElevenLabs API key
//   ELEVENLABS_VOICE_ID  (optional) the voice ID; defaults to Charlotte below
//   ELEVENLABS_MODEL_ID  (optional) defaults to eleven_multilingual_v2

const DEFAULT_VOICE_ID = '6fZce9LFNG3iEITDfqZZ'; // Charlotte
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';
const MAX_CHARS = 1500;

export default async function handler(req, res) {
  try {
    const raw = (req.query && req.query.text) ? String(req.query.text) : '';
    const text = raw.slice(0, MAX_CHARS).trim();
    if (!text) {
      res.status(400).json({ error: 'Missing text.' });
      return;
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Server is missing ELEVENLABS_API_KEY.' });
      return;
    }

    const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
    const modelId = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID;

    const upstream = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voiceId),
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: text,
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      res.status(upstream.status).json({
        error: 'ElevenLabs request failed.',
        status: upstream.status,
        detail: detail.slice(0, 500)
      });
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    // Cache the same briefing on the CDN so we only pay for it once per change.
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
    res.status(200).send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Unexpected error.', detail: String(err && err.message || err) });
  }
}
