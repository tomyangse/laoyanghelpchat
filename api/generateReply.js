// Vercel Serverless Function
// Handles generating a reply based on context and user intent.

import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { originalText, language, userIntent, tone } = await req.json();
        
        if (!originalText || !language || !userIntent || !tone) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        let toneInstruction = '';
        switch (tone) {
            case 'casual':
                toneInstruction = `语气要非常随意、口语化，就像和好朋友聊天一样。`;
                break;
            case 'friendly':
                toneInstruction = `语气要友好、标准，适合大多数日常场景。`;
                break;
            case 'polite':
                toneInstruction = `语气要礼貌、客气，可以稍微正式一点。`;
                break;
            case 'business':
                toneInstruction = `语气要非常商务、正式，适合工作场合。`;
                break;
        }

        const generationPrompt = `你是一位精通 ${language} 的语言专家和沟通高手。
你的任务是帮我回复一条信息。
原始信息是（用 ${language} 写的）：“${originalText}”
我想表达的意思是（用中文描述）：“${userIntent}”
${toneInstruction}
请为我生成一个自然、地道、符合本地人习惯的 ${language} 回复。
你的回复应该优先使用 'Hi', 'Hello' 等通用问候语，避免使用和时间相关的问候语（如 'Good morning'），除非在上下文中非常必要和自然。
请直接生成 ${language} 的回复内容，不要包含任何额外的解释或标题。`;
        
        const generationResult = await model.generateContent(generationPrompt);
        const generatedReply = generationResult.response.text();
        
        const translationPrompt = `请将以下 ${language} 文本翻译成自然流畅的中文：\n\n"${generatedReply}"`;
        const translationResult = await model.generateContent(translationPrompt);
        const translatedReply = translationResult.response.text();

        return new Response(JSON.stringify({
            reply: generatedReply.trim(),
            replyTranslation: translatedReply.trim()
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Error in generateReply API:", error);
        return new Response(JSON.stringify({ error: 'Failed to generate reply.', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

