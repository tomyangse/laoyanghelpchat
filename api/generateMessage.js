// Vercel Serverless Function
// Handles the "Proactively Write" feature.

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
    console.log("--- [generateMessage] API Endpoint Hit ---");

    if (req.method !== 'POST') {
        console.warn("[generateMessage] Method not allowed:", req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { targetLanguage, userIntent, tone } = await getBody(req);
        console.log(`[generateMessage] Received request: lang=${targetLanguage}, tone=${tone}`);


        if (!targetLanguage || !userIntent || !tone) {
            console.error("[generateMessage] Error: Missing required fields.");
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        let toneInstruction = '';
        switch (tone) {
            case 'casual': toneInstruction = `语气要非常随意、口语化，就像和好朋友聊天一样。`; break;
            case 'friendly': toneInstruction = `语气要友好、标准，适合大多数日常场景。`; break;
            case 'polite': toneInstruction = `语气要礼貌、客气，可以稍微正式一点。`; break;
            case 'business': toneInstruction = `语气要非常商务、正式，适合工作场合。`; break;
        }

        const generationPrompt = `你是一位精通 ${targetLanguage} 的语言专家和写作助手。你的任务是根据用户的意图，用 ${targetLanguage} 写一条信息。用户的意图是（用中文描述）：“${userIntent}” ${toneInstruction} 请直接生成 ${targetLanguage} 的信息内容，不要包含任何额外的解释或标题。`;
        
        console.log("[generateMessage] Sending generation request to Gemini API...");
        const generationResult = await model.generateContent(generationPrompt);
        const genCandidates = generationResult.response.candidates;
        if (!genCandidates || genCandidates.length === 0 || !genCandidates[0].content || !genCandidates[0].content.parts || genCandidates[0].content.parts.length === 0) {
            console.error("[generateMessage] Gemini API returned no content for generation.", JSON.stringify(generationResult.response));
            throw new Error("API returned no content for generation, it might be blocked due to safety settings.");
        }
        const generatedMessage = genCandidates[0].content.parts[0].text;
        console.log("[generateMessage] Successfully generated message.");

        const translationPrompt = `请将以下 ${targetLanguage} 文本翻译成自然流畅的中文：\n\n"${generatedMessage}"`;
        console.log("[generateMessage] Sending translation request to Gemini API...");
        const translationResult = await model.generateContent(translationPrompt);
        const transCandidates = translationResult.response.candidates;
        if (!transCandidates || transCandidates.length === 0 || !transCandidates[0].content || !transCandidates[0].content.parts || transCandidates[0].content.parts.length === 0) {
            console.error("[generateMessage] Gemini API returned no content for translation.", JSON.stringify(translationResult.response));
            throw new Error("API returned no content for translation, it might be blocked due to safety settings.");
        }
        const translatedMessage = transCandidates[0].content.parts[0].text;
        console.log("[generateMessage] Successfully translated message.");

        console.log("--- [generateMessage] API Request Completed Successfully ---");
        return res.status(200).json({
            reply: generatedMessage.trim(),
            replyTranslation: translatedMessage.trim()
        });

    } catch (error) {
        console.error("!!! [generateMessage] CRITICAL ERROR:", error);
        return res.status(500).json({ error: 'Failed to generate message.', details: error.message });
    }
}


