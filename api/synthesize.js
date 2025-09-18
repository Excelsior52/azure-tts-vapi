const axios = require('axios');

const AZURE_KEY = process.env.AZURE_KEY;
const AZURE_REGION = 'francecentral'; // ou westeurope, selon ton compte
const VOICE = 'fr-FR-DeniseNeural';

export default async function handler(req, res) {
  const message = req.body?.message;
  const text = message?.text || 'Bonjour, je suis Denise.';

  try {
    const response = await axios({
      method: 'POST',
      url: `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'raw-16khz-16bit-mono-pcm',
        'User-Agent': 'azure-vapi'
      },
      data: `
        <speak version='1.0' xml:lang='fr-FR'>
          <voice xml:lang='fr-FR' xml:gender='Female' name='${VOICE}'>
            ${text}
          </voice>
        </speak>
      `,
      responseType: 'arraybuffer'
    });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(response.data);

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Erreur Azure TTS' });
  }
}
