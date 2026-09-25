const allowedOrigins = new Set([
  "https://liseman.github.io",
  "http://localhost:4173",
  "http://127.0.0.1:4173"
]);
const model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
}

function json(body,status,origin) {
  return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json",...cors(origin)}});
}

function cleanJoke(value) {
  return String(value || "").trim().replace(/^['“\"]|['”\"]$/g, "").replace(/^(joke|answer):\s*/i, "").trim();
}

function normalized(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}

export function buildPrompt(traits,history,purpose="result",context={}) {
  const avoid=history.length?`\nNever repeat or closely paraphrase these earlier jokes:\n- ${history.join("\n- ")}`:"";
  const preferences=context.preferences?.length?` The reader has preferred ${context.preferences.join(", ")} so far; tune the joke to that taste without diluting the target style.`:"";
  const feedback=context.feedback?.length?`\n\nActual choices from this reader:\n${context.feedback.map((choice,index)=>`${index+1}. LIKED: ${choice.liked}\n   REJECTED: ${choice.disliked}`).join("\n")}\nInfer the concrete differences between what they liked and rejected. Do not copy either joke; use those differences to guide premise, rhythm, and punchline.`:"";
  const crowd=context.crowd?.length?`\n\nAnonymous aggregate feedback from other readers:\n${context.crowd.map(item=>`${item.score>0?"WORKED":"FAILED"} (${Math.abs(item.score)} votes): ${item.text}`).join("\n")}\nLearn from the contrast. Never copy these examples.`:"";
  const assignment=purpose==="choice"?`The primary style must be ${traits.join(", ")}.${preferences}`:`The reader likes ${traits.join(", ")}.`;
  return `Write genuinely funny, original jokes. ${assignment}

Silently brainstorm at least five premises and develop the strongest three into complete jokes. Each needs an actual comic turn, not merely a quirky statement or observation. Build from a recognizable human truth or sharply observed detail, then make a surprising but logical turn. Prefer specificity, compression, and a confident ending.

Do not use stock AI-comedy devices: no sentient office objects, animals filing paperwork, "my therapist says," existential appliances, meetings that "could have been an email," dating-app clichés, or "plot twist." No generic dad jokes, recycled internet jokes, cruelty, explanation, labels, quotation marks, or preamble. One or two sentences; under 55 words.${feedback}${crowd}${avoid}

Return exactly three candidates separated by |||, with no numbering or commentary.`;
}

const crowdKey="crowd-humor-model-v1";

async function crowdModel(env) {
  if(!env.HUMOR_STATS) return [];
  return await env.HUMOR_STATS.get(crowdKey,"json")||[];
}

export async function recordFeedback(env,input) {
  if(!env.HUMOR_STATS) return;
  const model=await crowdModel(env);
  const traits=Array.isArray(input.traits)?input.traits.slice(0,3).map(String):[];
  const update=(text,delta)=>{
    text=String(text||"").slice(0,300).trim();
    if(!text) return;
    const key=normalized(text);
    let item=model.find(entry=>entry.key===key);
    if(!item){ item={key,text,score:0,votes:0,traits}; model.push(item); }
    item.score+=delta; item.votes++; item.traits=traits;
  };
  if(input.kind==="choice"){ update(input.liked,1); update(input.disliked,-1); }
  else if(input.kind==="rating"){ const rating=Math.max(1,Math.min(5,Number(input.rating)||3)); update(input.joke,rating-3); }
  else return;
  model.sort((a,b)=>b.votes-a.votes||Math.abs(b.score)-Math.abs(a.score));
  await env.HUMOR_STATS.put(crowdKey,JSON.stringify(model.slice(0,100)));
}

function crowdGuidance(model,traits) {
  const relevant=model.filter(item=>!item.traits?.length||item.traits.some(trait=>traits.includes(trait)));
  const pool=relevant.length>=4?relevant:model;
  return [...pool].sort((a,b)=>b.score-a.score).slice(0,3).concat([...pool].sort((a,b)=>a.score-b.score).slice(0,3)).filter((item,index,all)=>all.findIndex(other=>other.key===item.key)===index).slice(0,6);
}

function candidatesFrom(value) {
  return String(value || "").split("|||").map(cleanJoke).filter(joke=>joke.length>=20&&joke.length<=400);
}

async function pickBest(env,candidates,traits) {
  if(candidates.length===1) return candidates[0];
  const result=await env.AI.run(model,{messages:[
    {role:"system",content:"You are a merciless comedy editor. Select the joke most likely to produce an actual laugh, not the one that is merely clever or whimsical."},
    {role:"user",content:`Choose the funniest finished joke for ${traits.join(", ")}. Reward a clear premise, surprise, specificity, and a strong final beat. Reject fragments, familiar premises, and AI whimsy. Reply only with its number.\n${candidates.map((joke,index)=>`${index+1}. ${joke}`).join("\n")}`}
  ],max_tokens:8,temperature:0});
  const index=Number.parseInt(result.response,10)-1;
  return candidates[index]||candidates[0];
}

async function generateJoke(env,traits,history,purpose,context={}) {
  const previous=new Set(history.map(normalized));
  for(let attempt=0;attempt<3;attempt++) {
    const result=await env.AI.run(model,{messages:[
      {role:"system",content:"You are a ruthless professional comedy writer. Originality and a real punchline matter more than sounding whimsical. Return only finished material."},
      {role:"user",content:buildPrompt(traits,history,purpose,context)}
    ],max_tokens:160,temperature:1});
    const candidates=candidatesFrom(result.response).filter(joke=>!previous.has(normalized(joke)));
    const joke=candidates.length?await pickBest(env,candidates,traits):"";
    if(joke.length>=20 && joke.length<=400 && !previous.has(normalized(joke))) return joke;
  }
  return null;
}

export async function handleRequest(request,env) {
  const origin=request.headers.get("Origin") || "";
  if(!allowedOrigins.has(origin)) return json({error:"Origin not allowed"},403,origin);
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers:cors(origin)});
  if(request.method!=="POST") return json({error:"Method not allowed"},405,origin);

  try {
    const input=await request.json();
    const traits=Array.isArray(input.traits)?input.traits.slice(0,3).map(String):[];
    const history=Array.isArray(input.history)?input.history.slice(-40).map(value=>String(value).slice(0,300)):[];
    const feedback=Array.isArray(input.feedback)?input.feedback.slice(-8).map(choice=>({liked:String(choice?.liked||"").slice(0,300),disliked:String(choice?.disliked||"").slice(0,300)})).filter(choice=>choice.liked&&choice.disliked):[];
    if(input.mode==="feedback") { await recordFeedback(env,input); return json({ok:true},202,origin); }
    const model=await crowdModel(env);
    if(input.mode==="pair") {
      const targets=Array.isArray(input.targets)?input.targets.slice(0,2).map(value=>String(value).slice(0,100)):[];
      const preferences=Array.isArray(input.preferences)?input.preferences.slice(0,3).map(value=>String(value).slice(0,100)):[];
      const round=Math.max(1,Math.min(3,Number(input.round)||1));
      if(targets.length!==2) return json({error:"Two humor targets are required"},400,origin);
      const context={preferences,round,feedback,crowd:crowdGuidance(model,preferences)};
      const first=await generateJoke(env,[targets[0]],history,"choice",context);
      const second=first&&await generateJoke(env,[targets[1]],[...history,first],"choice",context);
      if(first&&second) return json({jokes:[first,second]},200,origin);
      return json({error:"Could not produce a fresh joke pair"},503,origin);
    }
    if(!traits.length) return json({error:"Humor traits are required"},400,origin);
    const joke=await generateJoke(env,traits,history,"result",{feedback,crowd:crowdGuidance(model,traits)});
    return joke?json({joke},200,origin):json({error:"Could not produce a fresh joke"},503,origin);
  } catch {
    return json({error:"Joke generation failed"},500,origin);
  }
}

export default {fetch:handleRequest};
