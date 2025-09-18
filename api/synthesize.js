const axios = require('axios');

const AZURE_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_SPEECH_REGION;
const VOICE = 'fr-FR-DeniseNeural';

export default async function handler(req, res) {
  const text = req.body?.message?.text || "Bonjour, je suis Denise, votre assistante vocale.";

  try {
    const response = await axios({
      method: 'POST',
      url: `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
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

    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Erreur de synthèse vocale Azure.' });
  }
}
