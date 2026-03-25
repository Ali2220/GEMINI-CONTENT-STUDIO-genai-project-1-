import dotenv from "dotenv";
dotenv.config();
import express from "express";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";

const app = express();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// agr upload folder nhi hai to create kro.
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

const promptTemplates = {
  article: (topic) => `Tum ek professional content writer ho. 
Topic: "${topic}" par ek detailed article likho Roman Urdu mein.
Structure: Introduction, 3 main points, conclusion.
Length: 400-500 words.
Style: Informative aur engaging.
Use headings (## for main sections).`,
  summary: (topic) => `"${topic}" ka comprehensive summary do Roman Urdu mein.
Main points cover karo, key takeaways include karo.
Length: 150-200 words.`,

  poem: (
    topic,
  ) => `"${topic}" par ek beautiful Urdu poem likho Roman script mein.
Style: Romantic ya philosophical.
Length: 6-8 lines.
Rhyme scheme: AABB ya ABAB.`,

  ideas: (topic) => `"${topic}" ke liye 10 innovative ideas do Roman Urdu mein.
Har idea ek line mein, creative aur practical ho.
Format: Numbered list.`,

  bulletPoints: (
    topic,
  ) => `"${topic}" ke 5 important points bullet points mein likho Roman Urdu mein.
Har point detailed ho, sirf headings nahi.`,

  tutorial: (
    topic,
  ) => `"${topic}" par step-by-step tutorial likho Roman Urdu mein.
Steps clear hon, beginners ke liye easy ho.
Include: Prerequisites, Steps with explanation, Tips.`,
};

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "project is running",
  });
});

// Generate Content endpoint (streaming)
app.post("/api/generate", async (req, res) => {
  try {
    const { topic, contentType, temperature, maxLength } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic required" });
    }

    if (!contentType) {
      return res.status(400).json({ error: "ContentType is required" });
    }

    const prompt = promptTemplates[contentType](topic);

    // streaming ke liye headers set kr rhe hain. (frontend ko bta rhe hain ke data chunk by chunk ayega)
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");

    const response = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: parseFloat(temperature) || 0.7,
      },
    });

    for await (const chunk of response) {
      res.write(chunk.text);
    }

    res.end();
  } catch (error) {
    res.status(500).send("Error generating content: ", error.message);
  }
});

// multi-modal image analysis
app.post("/api/analyze-image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image required" });
    }

    const imageBuffer = fs.readFileSync(req.file.path);
    const base64 = imageBuffer.toString("base64");
    const mimeType = `image/${path.extname(req.file.originalname).substring(1)}`;
    const question =
      req.body.question ||
      "Is image mein kya hai? Roman Urdu mein detail mein batao.";

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: question },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64,
              },
            },
          ],
        },
      ],
    });

    fs.unlinkSync(req.file.path);
    res.json({ response: response.text });
  } catch (error) {
    res.status(500).json({ error: "Image analysis failed: " + error.message });
  }
});

// chat endpoint with history
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, systemInstruction } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Messsage is required" });
    }

    const contents = history || [];
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    // headers set kiye hain streaming ke liye
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");

    const response = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        temperature: 0.7,
        systemInstruction:
          systemInstruction ||
          "Tum ek helpful assistant ho. Roman Urdu mein jawab do. Friendly aur mazedaar style mein baat karo.",
      },
    });

    for await (const chunk of response) {
      res.write(chunk.text);
    }

    res.end();
  } catch (error) {
    res.status(500).send("Error in chat: " + error.message);
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
