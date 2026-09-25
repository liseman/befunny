import test from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, handleRequest, recordFeedback } from "../worker/index.js";

test("AI prompt includes the humor profile and previous jokes",()=>{
  const prompt=buildPrompt(["deadpan","observational"],["An old joke."],"result",{feedback:[{liked:"A precise joke.",disliked:"A vague joke."}]});
  assert.match(prompt,/deadpan, observational/);
  assert.match(prompt,/Never repeat/);
  assert.match(prompt,/An old joke\./);
  assert.match(prompt,/brainstorm at least five premises/);
  assert.match(prompt,/no sentient office objects/i);
  assert.match(prompt,/exactly three candidates/);
  assert.match(prompt,/LIKED: A precise joke/);
  assert.match(prompt,/REJECTED: A vague joke/);
});

test("individual feedback updates the shared humor model",async()=>{
  let stored=[];
  const env={HUMOR_STATS:{get:async()=>stored,put:async (_key,value)=>{stored=JSON.parse(value);}}};
  await recordFeedback(env,{kind:"choice",liked:"A joke readers liked.",disliked:"A joke readers rejected.",traits:["dry"]});
  await recordFeedback(env,{kind:"rating",joke:"A joke readers liked.",rating:5,traits:["dry"]});
  assert.deepEqual(stored.map(({text,score,votes})=>({text,score,votes})),[
    {text:"A joke readers liked.",score:3,votes:2},
    {text:"A joke readers rejected.",score:-1,votes:1}
  ]);
});

test("aggregate feedback is included in future generation prompts",async()=>{
  const prompts=[];
  const env={
    HUMOR_STATS:{get:async()=>[{key:"good",text:"A proven crowd favorite.",score:8,votes:10,traits:["dry"]}],put:async()=>{}},
    AI:{run:async (_model,input)=>{prompts.push(input.messages[1].content);return {response:"A sufficiently long fresh joke for testing."};}}
  };
  const request=new Request("https://worker.example",{method:"POST",headers:{Origin:"https://liseman.github.io","Content-Type":"application/json"},body:JSON.stringify({traits:["dry"],history:[]})});
  const response=await handleRequest(request,env);
  assert.equal(response.status,200);
  assert.match(prompts[0],/WORKED \(8 votes\): A proven crowd favorite/);
});

test("worker uses a comedy editor to choose the strongest candidate",async()=>{
  const replies=[
    "The first complete joke is ordinary.|||The second complete joke has a sharper turn.|||The third complete joke is merely quirky.",
    "2"
  ];
  const env={AI:{run:async()=>({response:replies.shift()})}};
  const request=new Request("https://worker.example",{method:"POST",headers:{Origin:"https://liseman.github.io","Content-Type":"application/json"},body:JSON.stringify({traits:["dry"],history:[]})});
  const response=await handleRequest(request,env);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{joke:"The second complete joke has a sharper turn."});
});

test("worker generates a fresh adaptive quiz pair",async()=>{
  const replies=["A specific first punchline with enough characters.","A different second punchline with enough characters."];
  const prompts=[];
  const env={AI:{run:async (_model,input)=>{prompts.push(input.messages[1].content);return {response:replies.shift()};}}};
  const request=new Request("https://worker.example",{method:"POST",headers:{Origin:"https://liseman.github.io","Content-Type":"application/json"},body:JSON.stringify({mode:"pair",targets:["absurdist leaps","dry observations"],preferences:["subtle deadpan"],feedback:[{liked:"The winner.",disliked:"The loser."}],round:2,history:[]})});
  const response=await handleRequest(request,env);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{jokes:["A specific first punchline with enough characters.","A different second punchline with enough characters."]});
  assert.match(prompts[0],/absurdist leaps/);
  assert.match(prompts[0],/subtle deadpan/);
  assert.match(prompts[1],/dry observations/);
  assert.match(prompts[0],/LIKED: The winner/);
});

test("worker retries a repeated joke and returns fresh AI material",async()=>{
  const replies=["An old joke.","My inbox reached enlightenment. It has stopped expecting closure."];
  const env={AI:{run:async()=>({response:replies.shift()})}};
  const request=new Request("https://worker.example",{method:"POST",headers:{Origin:"https://liseman.github.io","Content-Type":"application/json"},body:JSON.stringify({traits:["dry"],history:["An old joke."]})});
  const response=await handleRequest(request,env);
  assert.equal(response.status,200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"),"https://liseman.github.io");
  assert.deepEqual(await response.json(),{joke:"My inbox reached enlightenment. It has stopped expecting closure."});
});
