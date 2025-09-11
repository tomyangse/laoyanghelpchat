// Vercel Serverless Function
// Handles image analysis: OCR, language detection, and translation.

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
    console.log("--- [analyzeImage] API Endpoint Hit ---");

    if (req.method !== 'POST') {
        console.warn("[analyzeImage] Method not allowed:", req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { image: base64ImageData } = await getBody(req);
        console.log("[analyzeImage] Received request with image data.");

        if (!base64ImageData) {
             console.error("[analyzeImage] Error: No image data provided in request.");
            return res.status(400).json({ error: 'No image data provided' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // FINAL MODEL NAME UPDATE
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = "从这张图片中提取所有文字。然后，判断这些文字是什么语言（例如：English, Spanish, Chinese）。最后，将提取的文字翻译成简体中文。请以JSON格式返回结果，包含三个字段：'text' (提取的原文), 'language' (检测到的语言), 和 'translation' (中文翻译)。";
        
        const imagePart = {
            inlineData: {
                data: base64ImageData,
                mimeType: "image/jpeg",
            },
        };

        console.log("[analyzeImage] Sending request to Gemini Vision API...");
        const result = await model.generateContent([prompt, imagePart]);
        const response = result.response;
        console.log("[analyzeImage] Successfully received response from Gemini API.");
        
        const candidates = response.candidates;
        if (!candidates || candidates.length === 0 || !candidates[0].content || !candidates[0].content.parts || candidates[0].content.parts.length === 0) {
            console.error("[analyzeImage] Gemini API returned no content. It might be blocked due to safety settings.", JSON.stringify(response));
            throw new Error("API returned no content, it might be blocked due to safety settings.");
        }
        const responseText = candidates[0].content.parts[0].text;
        console.log("[analyzeImage] Extracted text from response.");

        const jsonString = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        const data = JSON.parse(jsonString);
        console.log("[analyzeImage] Successfully parsed JSON response.");

        console.log("--- [analyzeImage] API Request Completed Successfully ---");
        return res.status(200).json(data);

    } catch (error) {
        console.error("!!! [analyzeImage] CRITICAL ERROR:", error);
        return res.status(500).json({ error: 'Failed to analyze image.', details: error.message });
    }
}


