import { jokes, dimensions, selectPair, selectResultJoke, applyChoice, topTraits, encodeProfile, decodeProfile } from "./humor.js";

const app=document.querySelector("#app");
const storedRatings=JSON.parse(localStorage.getItem("beFunnyRatings") || "{}");
const jokeApi="https://be-funny-jokes.lukeiseman.workers.dev";
let state={screen:"home",round:0,profile:{},seen:[],seedSeen:[],pair:[],pairLoading:false};
let pairRequest=0;

function render(){
  if(state.screen==="home") renderHome();
  else if(state.screen==="quiz") renderQuiz();
  else renderResult();
  app.focus({preventScroll:true});
}

function renderHome(){
  app.innerHTML=`<section class="hero"><div><p class="eyebrow">A three-question comedy calibration</p><h1>MAKE AI<br><em>ACTUALLY</em><br>FUNNY.</h1><p class="lede">Pick between three pairs of jokes. We’ll diagnose your comedy taste and give you a prompt that makes any AI <strong>less painfully boring.</strong></p><button class="button" id="begin">Begin the funny test&nbsp; →</button></div><div class="hero-art" aria-hidden="true"><div class="blob"><div class="face">☻</div></div><span class="sticker one">3 PICKS<br>ZERO DIGNITY</span><span class="sticker two">CLINICALLY<br>AMUSING*</span></div></section>`;
  document.querySelector("#begin").onclick=start;
}

function start(refine=false){
  const prior=refine?state.profile:{};
  const seen=refine?[...state.seen]:[];
  const seedSeen=refine?[...state.seedSeen]:[];
  state={screen:"quiz",round:0,profile:prior,seen,seedSeen,pair:[],pairLoading:true};
  history.replaceState({},"",location.pathname); preparePair();
}

function renderQuiz(){
  const pct=((state.round+1)/3)*100;
  const choices=state.pairLoading?[0,1].map(i=>`<button class="joke-card" disabled><span class="card-letter">OPTION ${i?"B":"A"}</span><span class="joke-text">Writing you something new…</span></button>`).join(""):state.pair.map((j,i)=>`<button class="joke-card" data-id="${j.id}"><span class="card-letter">OPTION ${i?"B":"A"}</span><span class="joke-text">${j.text}</span><span class="pick"><span>THIS ONE</span><span>→</span></span></button>`).join("");
  app.innerHTML=`<section class="quiz"><div class="quiz-top"><div><p class="eyebrow">Trust your gut. It has excellent taste.</p><h2>Which one is funnier?</h2></div><div class="progress-label">ROUND ${state.round+1} OF 3<div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></div></div><div class="choices">${choices}</div></section>`;
  document.querySelectorAll(".joke-card").forEach(card=>card.onclick=()=>choose(card.dataset.id));
}

function choose(id){
  const winner=state.pair.find(j=>j.id===id), loser=state.pair.find(j=>j.id!==id);
  state.profile=applyChoice(state.profile,winner,loser); state.seen.push(...state.pair.map(j=>j.id)); state.round++;
  if(state.round>=3){ state.screen="result"; const encoded=encodeProfile(state.profile); history.replaceState({},"",`${location.pathname}?taste=${encoded}`); render(); }
  else preparePair();
}

async function preparePair(){
  const request=++pairRequest;
  let seeds=selectPair(state.profile,state.seedSeen,state.round,storedRatings);
  if(seeds.length<2){ state.seedSeen=[]; seeds=selectPair(state.profile,[],state.round,storedRatings); }
  state.seedSeen.push(...seeds.map(j=>j.id)); state.pair=[]; state.pairLoading=true; render();
  let pair;
  try { pair=await loadFreshPair(seeds); }
  catch { pair=seeds; }
  if(request!==pairRequest) return;
  state.pair=pair; state.pairLoading=false; render();
}

async function loadFreshPair(seeds){
  let history=[];
  try { history=JSON.parse(localStorage.getItem("beFunnyGeneratedPairJokes") || "[]"); } catch {}
  const targets=seeds.map(seed=>{ const tag=Object.entries(seed.tags).sort((a,b)=>b[1]-a[1])[0][0]; return dimensions[tag].description; });
  const preferences=Object.keys(state.profile).length?topTraits(state.profile).map(tag=>dimensions[tag].description):[];
  const response=await fetch(jokeApi,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"pair",targets,preferences,history:history.slice(-40),round:state.round+1}),signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw new Error("Pair generation failed");
  const {jokes:generated}=await response.json();
  if(!Array.isArray(generated)||generated.length!==2||generated.some(joke=>!joke||history.includes(joke))) throw new Error("Pair was not fresh");
  localStorage.setItem("beFunnyGeneratedPairJokes",JSON.stringify([...history,...generated].slice(-40)));
  return generated.map((text,index)=>({...seeds[index],id:`ai-${Date.now()}-${index}`,text}));
}

function resultCopy(traits){
  const lead=dimensions[traits[0]], support=dimensions[traits[1]];
  return `You like ${lead.description}, backed by ${support.description}. You prefer jokes that trust you to catch up instead of explaining themselves — specific, economical, and just strange enough to replay later.`;
}

function makePrompt(traits){
  return `Be funny in a way that feels ${traits.map(t=>dimensions[t].label).join(", ")}. Favor ${dimensions[traits[0]].description} and ${dimensions[traits[1]].description}. Keep jokes concise and specific. Trust the reader to get it; never explain the punchline. Avoid generic puns, canned setup-punchline rhythms, cruelty, and trying too hard. Aim for one surprising turn, delivered with confidence.`;
}

function renderResult(){
  const traits=topTraits(state.profile), prompt=makePrompt(traits);
  const previousJoke=localStorage.getItem("beFunnyLastResultJoke") || "";
  const best=selectResultJoke(state.profile,state.seen,previousJoke,storedRatings);
  localStorage.setItem("beFunnyLastResultJoke",best.id);
  const canRefine=true;
  app.innerHTML=`<section class="result"><div class="result-grid"><div class="result-main"><p class="eyebrow">Your comedy diagnosis</p><h1>${dimensions[traits[0]].label}<br>with a twist.</h1><p class="description">${resultCopy(traits)}</p><div class="trait-list">${traits.map(t=>`<span class="trait">${dimensions[t].label.toUpperCase()}</span>`).join("")}</div><p class="side-title">PASTE THIS INTO YOUR AI</p><div class="prompt-box"><pre id="prompt">${prompt}</pre><button class="button small copy" id="copy">Copy prompt</button></div></div><aside class="result-side"><p class="side-title" id="joke-label">GENERATING A FRESH JOKE…</p><p class="personal-joke" aria-live="polite">“${best.text}”</p><p class="side-title">DID WE NAIL IT?</p><div class="stars" role="group" aria-label="Rate this result">${[1,2,3,4,5].map(n=>`<button class="star" data-rating="${n}" aria-label="${n} star${n>1?'s':''}">★</button>`).join("")}</div><p class="rating-status" aria-live="polite"></p><div class="actions">${canRefine?'<button class="button small" id="refine">Refine further</button>':''}<button class="button small secondary" id="share">Share result</button><button class="button small secondary" id="restart">Start over</button></div><p class="share-status" aria-live="polite"></p></aside></div></section>`;
  document.querySelector("#copy").onclick=async()=>{ await copyText(prompt); document.querySelector("#copy").textContent="Copied!"; };
  document.querySelector("#share").onclick=share;
  document.querySelector("#restart").onclick=()=>start(false);
  if(canRefine) document.querySelector("#refine").onclick=()=>start(true);
  let displayedJokeId=best.id;
  document.querySelectorAll(".star").forEach(s=>s.onclick=()=>rate(Number(s.dataset.rating),displayedJokeId));
  loadFreshJoke(traits).then(joke=>{
    document.querySelector(".personal-joke").textContent=`“${joke}”`;
    document.querySelector("#joke-label").textContent="A FRESH JOKE, MADE FOR YOU";
    displayedJokeId=`generated:${joke.slice(0,80)}`;
  }).catch(()=>{ document.querySelector("#joke-label").textContent="A JOKE YOU SHOULD LIKE"; });
}

async function loadFreshJoke(traits){
  let history=[];
  try { history=JSON.parse(localStorage.getItem("beFunnyGeneratedJokes") || "[]"); } catch {}
  const response=await fetch(jokeApi,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({traits:traits.map(t=>dimensions[t].description),history:history.slice(-12)}),signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error("Joke generation failed");
  const {joke}=await response.json();
  if(!joke || history.includes(joke)) throw new Error("Joke was not fresh");
  history.push(joke); localStorage.setItem("beFunnyGeneratedJokes",JSON.stringify(history.slice(-12)));
  return joke;
}

async function copyText(text){ try { await navigator.clipboard.writeText(text); } catch { const t=document.createElement("textarea");t.value=text;document.body.append(t);t.select();document.execCommand("copy");t.remove(); } }
async function share(){ const url=location.href, status=document.querySelector(".share-status"); if(navigator.share){try{await navigator.share({title:"My Be Funny result",text:"I diagnosed my sense of humor.",url});status.textContent="Shared. Comedy is now contagious.";return}catch{}} await copyText(url);status.textContent="Result link copied!"; }
function rate(value,jokeId){ document.querySelectorAll(".star").forEach((s,i)=>s.classList.toggle("active",i<value)); storedRatings[jokeId]=(storedRatings[jokeId]||0)+(value-3)*.3; localStorage.setItem("beFunnyRatings",JSON.stringify(storedRatings)); document.querySelector(".rating-status").textContent=value>3?"Excellent. Our tiny algorithm is blushing.":"Noted. The algorithm has entered therapy."; }

document.querySelector("#about-button").onclick=()=>document.querySelector("#about-dialog").showModal();
document.querySelector(".dialog-close").onclick=()=>document.querySelector("#about-dialog").close();
const shared=new URLSearchParams(location.search).get("taste"); if(shared){const profile=decodeProfile(shared);if(profile)state={...state,screen:"result",profile};}
render();
