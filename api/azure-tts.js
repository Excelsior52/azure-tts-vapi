export default async function handler(req, res) {
  // Configuration CORS pour Vapi
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Vapi-Secret');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Vapi envoie le texte dans ce format
    const { text, sampleRate, voice } = req.body;
    
    if (!text) {
      console.log('Corps de requête reçu:', JSON.stringify(req.body, null, 2));
      return res.status(400).json({ 
        error: 'Texte manquant',
        received: req.body 
      });
    }
    
    // Mapping des voix françaises Azure
    const voiceMap = {
      'denise': 'fr-FR-DeniseNeural',
      'henri': 'fr-FR-HenriNeural', 
      'vivienne': 'fr-FR-VivienneMultilingualNeural',
      'default': 'fr-FR-DeniseNeural'
    };
    
    const selectedVoice = voiceMap[voice] || voiceMap.default;
    
    console.log(`Génération TTS Azure pour: "${text.substring(0, 100)}..." avec voix: ${selectedVoice}, sampleRate: ${sampleRate}`);
    
    // Vérification des variables d'environnement
    if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
      return res.status(500).json({ 
        error: 'Configuration Azure manquante',
        details: 'AZURE_SPEECH_KEY et AZURE_SPEECH_REGION requis'
      });
    }
    
    // 1. Obtenir un token d'accès
    const tokenResponse = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Erreur token Azure:', error);
      return res.status(500).json({ 
        error: 'Impossible d\'obtenir le token Azure',
        details: error 
      });
    }
    
    const accessToken = await tokenResponse.text();
    
    // 2. Créer le SSML pour la synthèse vocale
    const ssml = `<?xml version="1.0" encoding="UTF-8"?>
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fr-FR">
  <voice name="${selectedVoice}">
    ${text}
  </voice>
</speak>`;
    
    // 3. Format audio pour Vapi (PCM brut selon leur sampleRate)
    const outputFormat = sampleRate === 24000 ? 
      'raw-24khz-16bit-mono-pcm' : 
      'raw-16khz-16bit-mono-pcm';
    
    // 4. Appel à l'API Azure TTS
    const ttsResponse = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': outputFormat,
        'User-Agent': 'vapi-azure-tts-proxy'
      },
      body: ssml
    });
    
    if (!ttsResponse.ok) {
      const error = await ttsResponse.text();
      console.error('Erreur Azure TTS:', error);
      return res.status(500).json({ 
        error: 'Erreur Azure TTS',
        details: error,
        status: ttsResponse.status
      });
    }
    
    // 5. Retourner l'audio PCM brut directement (format requis par Vapi)
    const audioBuffer = await ttsResponse.arrayBuffer();
    
    console.log(`Audio PCM généré avec succès - Taille: ${audioBuffer.byteLength} bytes`);
    
    // 6. Réponse pour Vapi - DOIT être du PCM brut
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', audioBuffer.byteLength.toString());
    
    return res.status(200).send(Buffer.from(audioBuffer));
    
  } catch (error) {
    console.error('Erreur dans azure-tts:', error);
    return res.status(500).json({
      error: 'Erreur serveur interne',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
