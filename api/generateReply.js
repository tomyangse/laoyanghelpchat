// Vercel Serverless Function
// This function handles generating the reply.
// It receives the original text, its language, the user's intent in Chinese, and the desired tone.
// It then calls the Gemini API to generate a natural, tone-appropriate reply in the original language.

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
            return response.status(400).json({ error: 'Missing required fields for generating a reply.' });
        }

        // Map frontend tone to a more descriptive instruction for the AI
        const toneInstructions = {
            casual: "in a very casual, informal, and friendly tone, like talking to a close friend.",
            friendly: "in a standard friendly and polite tone.",
            polite: "in a respectful and polite tone, suitable for someone you don't know well or a senior person.",
            business: "in a formal, professional, and business-like tone."
        };

        const instruction = toneInstructions[tone] || toneInstructions.friendly;

        // Construct the prompt for Gemini
        const prompt = `
            You are an expert language assistant. Your task is to help me reply to a message.
            The language of the conversation is ${language}.
            The message I received was: "${originalText}"
            My intention for the reply, written in Chinese, is: "${userIntent}"
            
            Please generate a natural and culturally appropriate reply in ${language} for me.
            The reply must be ${instruction}
            Only output the final reply text, with no extra explanations or quotation marks.
        `;
        
        const apiKey = process.env.GEMINI_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        const payload = {
            contents: [
                { parts: [{ text: prompt }] }
            ]
        };

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorBody = await apiResponse.text();
            console.error('Gemini API Error:', errorBody);
            throw new Error(`Gemini API failed with status: ${apiResponse.status}`);
        }

        const result = await apiResponse.json();

        const candidate = result.candidates?.[0];
        const replyText = candidate?.content?.parts?.[0]?.text;

        if (!replyText) {
            throw new Error('Could not generate a reply from the Gemini API response.');
        }

        return response.status(200).json({ reply: replyText.trim() });

    } catch (error) {
        console.error('Error in generateReply handler:', error);
        return response.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}
