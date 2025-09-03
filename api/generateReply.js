// Vercel Serverless Function
// This function handles generating the reply.
// It generates a reply in the target language, then translates it back to Chinese for verification.

export const config = {
    maxDuration: 60,
};

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { originalText, language, userIntent, tone } = request.body;

        if (!originalText || !language || !userIntent || !tone) {
            return response.status(400).json({ error: 'Missing required fields.' });
        }

        const toneInstructions = {
            casual: "in a very casual, informal, and friendly tone, like talking to a close friend.",
            friendly: "in a standard friendly and polite tone.",
            polite: "in a respectful and polite tone, suitable for someone you don't know well or a senior person.",
            business: "in a formal, professional, and business-like tone."
        };
        const instruction = toneInstructions[tone] || toneInstructions.friendly;

        const apiKey = process.env.GEMINI_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        // Step 1: Generate the reply in the foreign language
        const generationPrompt = `
            You are an expert language assistant. Your task is to help me reply to a message.
            The language of the conversation is ${language}.
            The message I received was: "${originalText}"
            My intention for the reply, written in Chinese, is: "${userIntent}"
            Please generate a natural and culturally appropriate reply in ${language} for me. The reply must be ${instruction}
            IMPORTANT GREETING RULE: For salutations, please prefer to use generic greetings like "Hi,", "Hello,". Avoid using time-specific greetings (e.g., "Good morning").
            Only output the final reply text, with no extra explanations or quotation marks.
        `;

        const generationResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: generationPrompt }] }] })
        });

        if (!generationResponse.ok) throw new Error(`Gemini API (generation) failed with status: ${generationResponse.status}`);
        
        const generationResult = await generationResponse.json();
        const replyText = generationResult.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!replyText) throw new Error('Could not generate a reply from the Gemini API response.');

        // Step 2: Translate the generated reply back to Chinese for verification
        const translationPrompt = `
            Translate the following text accurately from ${language} to Chinese.
            Only output the translated Chinese text, without any explanations or quotation marks.
            Text to translate: "${replyText}"
        `;

        const translationResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: translationPrompt }] }] })
        });
        
        if (!translationResponse.ok) {
             // If back-translation fails, still return the main reply
            console.error('Gemini API translation back to Chinese failed.');
            return response.status(200).json({ 
                reply: replyText.trim(),
                replyTranslation: '翻译失败，但回复已生成。' 
            });
        }

        const translationResult = await translationResponse.json();
        const replyTranslationText = translationResult.candidates?.[0]?.content?.parts?.[0]?.text;

        return response.status(200).json({
            reply: replyText.trim(),
            replyTranslation: replyTranslationText ? replyTranslationText.trim() : '无法获取中文翻译。'
        });

    } catch (error) {
        console.error('Error in generateReply handler:', error);
        return response.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}

