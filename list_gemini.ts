import { config } from "dotenv";
config();

async function listGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("No key");
    return;
  }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  data.models?.forEach((m: any) => console.log(m.name));
}
listGemini();
