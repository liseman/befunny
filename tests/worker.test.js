import test from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, handleRequest } from "../worker/index.js";

test("AI prompt includes the humor profile and previous jokes",()=>{
  const prompt=buildPrompt(["deadpan","observational"],["An old joke."]);
  assert.match(prompt,/deadpan, observational/);
  assert.match(prompt,/Never repeat/);
  assert.match(prompt,/An old joke\./);
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

test("worker dynamically generates two contrasting jokes using current quiz context",async()=>{
  const replies=["The moon filed a noise complaint against the wolves.","My meeting had an agenda, which was ambitious of it."];
  const prompts=[];
  const env={AI:{run:async (_model,input)=>{ prompts.push(input.messages[1].content); return {response:replies.shift()}; }}};
  const request=new Request("https://worker.example",{method:"POST",headers:{Origin:"https://liseman.github.io","Content-Type":"application/json"},body:JSON.stringify({mode:"pair",targets:["absurdist leaps","dry observations"],preferences:["subtle deadpan"],round:2,history:[]})});
  const response=await handleRequest(request,env);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{jokes:["The moon filed a noise complaint against the wolves.","My meeting had an agenda, which was ambitious of it."]});
  assert.match(prompts[0],/absurdist leaps/);
  assert.match(prompts[1],/dry observations/);
  assert.match(prompts[0],/subtle deadpan/);
  assert.match(prompts[0],/round 2/);
});
