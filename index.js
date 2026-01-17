import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

// ================= LONG-TERM MEMORY =================
let longTermMemory = [];

function storeMemory(text) {
  const t = text.toLowerCase();

  if (t.includes("my name is")) {
    longTermMemory.push("User name: " + text.split("my name is")[1].trim());
  }

  if (t.includes("remember that")) {
    longTermMemory.push(text.replace("remember that", "").trim());
  }

  if (longTermMemory.length > 20) longTermMemory.shift();
}

// ================= JARVIS BRAIN =================
async function jarvisReply(input) {
  storeMemory(input);

  const memory =
    longTermMemory.length > 0
      ? "Long-term memory:\n- " + longTermMemory.join("\n- ")
      : "";

  const gpt = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.25,
      messages: [
        {
          role: "system",
          content:
            "You are JARVIS from Iron Man. Calm, intelligent, formal. " +
            "Short, confident replies. Always address the user as sir.\n\n" +
            memory
        },
        { role: "user", content: input }
      ]
    })
  });

  const gptData = await gpt.json();
  const reply = gptData.choices[0].message.content;

  const voice = await fetch(
    "https://api.elevenlabs.io/v1/text-to-speech/" + ELEVENLABS_VOICE_ID,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: reply,
        model_id: "eleven_turbo_v2",
        voice_settings: {
          stability: 0.25,
          similarity_boost: 0.9,
          style: 0.65,
          use_speaker_boost: true
        }
      })
    }
  );

  const audioBuffer = await voice.arrayBuffer();
  const audioBase64 = Buffer.from(audioBuffer).toString("base64");

  return { reply, audio: "data:audio/mpeg;base64," + audioBase64 };
}

// ================= UI =================
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
<title>J.A.R.V.I.S</title>
<style>
html,body{margin:0;height:100%;background:black;font-family:Arial;color:#8ff7ff;overflow:hidden}
.center{position:absolute;inset:0;display:flex;justify-content:center;align-items:center}
.core{width:520px;height:520px;border-radius:50%;border:2px solid #00e5ff;box-shadow:0 0 60px #00e5ff;position:relative}
.ring{position:absolute;border-radius:50%;border:1px solid rgba(0,229,255,.4);animation:spin linear infinite}
.r1{width:420px;height:420px;top:50px;left:50px;animation-duration:20s}
.r2{width:480px;height:480px;top:20px;left:20px;animation-duration:30s}
.r3{width:560px;height:560px;top:-20px;left:-20px;animation-duration:45s}
@keyframes spin{to{transform:rotate(360deg)}}
.wave{position:absolute;inset:30px;border-radius:50%;border:2px dashed rgba(0,229,255,.6);animation:pulse 1.2s infinite;opacity:0}
.wave.active{opacity:1}
@keyframes pulse{0%{transform:scale(1);opacity:.3}50%{transform:scale(1.08);opacity:1}100%{transform:scale(1);opacity:.3}}
.centerText{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center}
.title{font-size:28px;letter-spacing:6px}
.status{font-size:14px;margin-top:6px}
.log{position:absolute;bottom:120px;width:100%;text-align:center}
.mic{position:absolute;top:10px;right:10px;font-size:12px;opacity:.7}

.inputBox{
 position:absolute;
 bottom:40px;
 width:100%;
 text-align:center;
}
.inputBox input{
 width:60%;
 background:black;
 border:1px solid #00e5ff;
 color:#8ff7ff;
 padding:10px;
 outline:none;
 font-size:14px;
 box-shadow:0 0 15px rgba(0,229,255,.4);
}
</style>
</head>

<body>
<div class="mic">🎤 Listening</div>
<div class="center">
<div class="core">
<div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div>
<div class="wave" id="wave"></div>
<div class="centerText">
<div class="title">J.A.R.V.I.S</div>
<div class="status" id="status">Standby</div>
</div>
<div class="log" id="log">Say “Jarvis”</div>

<div class="inputBox">
<input id="textInput" placeholder="Type command…" />
</div>

</div>
</div>

<audio id="voice"></audio>

<script>
const log=document.getElementById("log");
const status=document.getElementById("status");
const wave=document.getElementById("wave");
const audio=document.getElementById("voice");
const textInput=document.getElementById("textInput");

const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const rec=new SR();
rec.continuous=true;
rec.lang="en-US";

let conversationActive=false;
let timeout;

function resetTimeout(){
 clearTimeout(timeout);
 timeout=setTimeout(()=>{
  conversationActive=false;
  status.innerText="Standby";
  log.innerText="Say “Jarvis”";
 },15000);
}

async function sendText(text){
 conversationActive=true;
 resetTimeout();
 status.innerText="Processing…";
 log.innerText="You: "+text;

 const r=await fetch("/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})});
 const d=await r.json();

 wave.classList.add("active");
 log.innerText="JARVIS: "+d.reply;

 audio.src=d.audio;
 audio.play().catch(()=>{});

 audio.onended=()=>{
  wave.classList.remove("active");
  status.innerText="Listening…";
 };
}

textInput.addEventListener("keydown",e=>{
 if(e.key==="Enter" && textInput.value.trim()){
  sendText(textInput.value.trim());
  textInput.value="";
 }
});

rec.onresult=async e=>{
 const speech=e.results[e.results.length-1][0].transcript.toLowerCase();

 if(!conversationActive && speech.includes("jarvis")){
  conversationActive=true;
  status.innerText="Listening…";
  log.innerText="Yes, sir?";
  resetTimeout();
  return;
 }

 if(conversationActive){
  resetTimeout();
  sendText(speech);
 }
};

rec.start();
</script>
</body>
</html>`);
});

// ================= API =================
app.post("/ask", async (req, res) => {
  const data = await jarvisReply(req.body.text || "");
  res.json(data);
});

app.listen(3000, () => {
  console.log("🟢 JARVIS CONTINUOUS CONVERSATION ONLINE");
});
