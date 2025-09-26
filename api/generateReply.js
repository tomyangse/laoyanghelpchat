// Vercel Serverless Function for generating replies to messages.

import { GoogleGenerativeAI } from "@google/generative-ai";

// Helper function to parse the request body
async function getBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', err => reject(err));
    });
}

export default async function handler(req, res) {
    console.log("--- [generateReply] API Endpoint Hit ---");

    if (req.method !== 'POST') {
        console.warn("[generateReply] Method not allowed:", req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { originalText, language, userIntent, tone } = await getBody(req);
        console.log(`[generateReply] Received request. Language: ${language}, Tone: ${tone}`);

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // --- NEW, STRICTER PROMPT ---
        const prompt = `
            You are a professional translator and a native ${language} speaker. Your task is to help me reply to a message.
            The original message I received was: "${originalText}"
            My reply intention in Chinese is: "${userIntent}"

            Your primary and most important goal is to ACCURATELY AND FAITHFULLY translate my intention. 
            - Do NOT add any information that I did not provide.
            - Do NOT change the core meaning of my message.
            - Pay extremely close attention to correctly translating pronouns like '我' (I) and '你' (you). Ensure the subject and object are correct.

            Your secondary goal is to adapt the translated text to sound natural and idiomatic in ${language}, matching a "${tone}" tone.

            Generate ONLY the final ${language} reply text, without any extra explanations or pleasantries.
        `;
        
        console.log("[generateReply] Sending request to Gemini API...");
        const result = await model.generateContent(prompt);
        const response = result.response;
        
        const candidates = response.candidates;
        if (!candidates || candidates.length === 0 || !candidates[0].content || !candidates[0].content.parts || candidates[0].content.parts.length === 0) {
            console.error("[generateReply] Gemini API returned no content.", JSON.stringify(response));
            throw new Error("API returned no content, it might be blocked due to safety settings.");
        }
        const generatedReply = candidates[0].content.parts[0].text.trim();
        console.log("[generateReply] Successfully received generated reply from API.");

        // --- Second call to translate the reply back to Chinese for verification ---
        const verificationPrompt = `Translate the following ${language} text to Simplified Chinese: "${generatedReply}"`;
        const verificationResult = await model.generateContent(verificationPrompt);
        const verificationResponse = verificationResult.response;
        const verificationCandidates = verificationResponse.candidates;
        if (!verificationCandidates || verificationCandidates.length === 0 || !verificationCandidates[0].content || !verificationCandidates[0].content.parts || verificationCandidates[0].content.parts.length === 0) {
             console.error("[generateReply] Gemini API returned no content for verification translation.", JSON.stringify(verificationResponse));
            throw new Error("API returned no content for verification translation.");
        }
        const replyTranslation = verificationCandidates[0].content.parts[0].text.trim();
        console.log("[generateReply] Successfully received verification translation.");

        console.log("--- [generateReply] API Request Completed Successfully ---");
        return res.status(200).json({ reply: generatedReply, replyTranslation: replyTranslation });

    } catch (error) {
        console.error("!!! [generateReply] CRITICAL ERROR:", error);
        return res.status(500).json({ error: 'Failed to generate reply.', details: error.message });
    }
}



