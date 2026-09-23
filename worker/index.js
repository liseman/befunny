const allowedOrigins = new Set([
  "https://liseman.github.io",
  "http://localhost:4173",
  "http://127.0.0.1:4173"
]);
const model = "@cf/meta/llama-3.1-8b-instruct-fast";

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

export function buildPrompt(traits,history,purpose="result") {
  const avoid=history.length?`\nNever repeat or closely paraphrase these earlier jokes:\n- ${history.join("\n- ")}`:"";
  const direction=purpose==="choice"?`Write one brand-new joke that strongly showcases ${traits.join(", ")}.`:`Write one brand-new joke for a reader who likes ${traits.join(", ")}.`;
  return `${direction} Make it concise (one or two sentences), specific, and self-contained. Use an unexpected turn and do not explain the punchline. Avoid generic dad jokes, recycled internet jokes, cruelty, quotation marks, labels, or preamble.${avoid}\nReturn only the joke.`;
}

async function generateJoke(env,traits,history,purpose) {
  const previous=new Set(history.map(normalized));
  for(let attempt=0;attempt<3;attempt++) {
    const result=await env.AI.run(model,{
      messages:[
        {role:"system",content:"You are an expert comedy writer. Create original, safe material and return only the requested joke."},
        {role:"user",content:buildPrompt(traits,history,purpose)}
      ],
      max_tokens:120,
      temperature:0.95
    });
    const joke=cleanJoke(result.response);
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
    const history=Array.isArray(input.history)?input.history.slice(-20).map(value=>String(value).slice(0,300)):[];
    if(input.mode==="pair") {
      const targets=Array.isArray(input.targets)?input.targets.slice(0,2).map(value=>String(value).slice(0,100)):[];
      if(targets.length!==2) return json({error:"Two humor targets are required"},400,origin);
      const first=await generateJoke(env,[targets[0]],history,"choice");
      const second=first&&await generateJoke(env,[targets[1]],[...history,first],"choice");
      if(first&&second) return json({jokes:[first,second]},200,origin);
      return json({error:"Could not produce a fresh joke pair"},503,origin);
    }
    if(!traits.length) return json({error:"Humor traits are required"},400,origin);
    const joke=await generateJoke(env,traits,history,"result");
    return joke?json({joke},200,origin):json({error:"Could not produce a fresh joke"},503,origin);
  } catch {
    return json({error:"Joke generation failed"},500,origin);
  }
}

export default {fetch:handleRequest};
