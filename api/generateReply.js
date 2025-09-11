// Vercel Serverless Function
// Handles generating a reply based on context and user intent.

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
        console.log(`[generateReply] Received request: lang=${language}, tone=${tone}`);
        
        if (!originalText || !language || !userIntent || !tone) {
            console.error("[generateReply] Error: Missing required fields.");
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        let toneInstruction = '';
        switch (tone) {
            case 'casual': toneInstruction = `语气要非常随意、口语化，就像和好朋友聊天一样。`; break;
            case 'friendly': toneInstruction = `语气要友好、标准，适合大多数日常场景。`; break;
            case 'polite': toneInstruction = `语气要礼貌、客气，可以稍微正式一点。`; break;
            case 'business': toneInstruction = `语气要非常商务、正式，适合工作场合。`; break;
        }

        const generationPrompt = `你是一位精通 ${language} 的语言专家和沟通高手。你的任务是帮我回复一条信息。原始信息是（用 ${language} 写的）：“${originalText}” 我想表达的意思是（用中文描述）：“${userIntent}” ${toneInstruction} 请为我生成一个自然、地道、符合本地人习惯的 ${language} 回复。你的回复应该优先使用 'Hi', 'Hello' 等通用问候语，避免使用和时间相关的问候语（如 'Good morning'），除非在上下文中非常必要和自然。请直接生成 ${language} 的回复内容，不要包含任何额外的解释或标题。`;
        
        console.log("[generateReply] Sending generation request to Gemini API...");
        const generationResult = await model.generateContent(generationPrompt);
        const genCandidates = generationResult.response.candidates;
        if (!genCandidates || genCandidates.length === 0 || !genCandidates[0].content || !genCandidates[0].content.parts || genCandidates[0].content.parts.length === 0) {
            console.error("[generateReply] Gemini API returned no content for generation.", JSON.stringify(generationResult.response));
            throw new Error("API returned no content for generation, it might be blocked due to safety settings.");
        }
        const generatedReply = genCandidates[0].content.parts[0].text;
        console.log("[generateReply] Successfully generated reply.");
        
        const translationPrompt = `请将以下 ${language} 文本翻译成自然流畅的中文：\n\n"${generatedReply}"`;
        console.log("[generateReply] Sending translation request to Gemini API...");
        const translationResult = await model.generateContent(translationPrompt);
        const transCandidates = translationResult.response.candidates;
         if (!transCandidates || transCandidates.length === 0 || !transCandidates[0].content || !transCandidates[0].content.parts || transCandidates[0].content.parts.length === 0) {
            console.error("[generateReply] Gemini API returned no content for translation.", JSON.stringify(translationResult.response));
            throw new Error("API returned no content for translation, it might be blocked due to safety settings.");
        }
        const translatedReply = transCandidates[0].content.parts[0].text;
        console.log("[generateReply] Successfully translated reply.");

        console.log("--- [generateReply] API Request Completed Successfully ---");
        return res.status(200).json({
            reply: generatedReply.trim(),
            replyTranslation: translatedReply.trim()
        });

    } catch (error) {
        console.error("!!! [generateReply] CRITICAL ERROR:", error);
        return res.status(500).json({ error: 'Failed to generate reply.', details: error.message });
    }
}

