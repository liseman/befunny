export const dimensions = {
  absurd: { label: "absurdist", description: "delightfully unhinged leaps" },
  dry: { label: "deadpan", description: "underplayed, straight-faced wit" },
  wordplay: { label: "wordplay", description: "language doing tiny backflips" },
  observational: { label: "observational", description: "painfully accurate everyday details" },
  dark: { label: "dark-ish", description: "a little doom, kept charming" },
  wholesome: { label: "wholesome", description: "warm jokes with no casualties" }
};

export const jokes = [
  { id:"a1", tags:{absurd:3,dry:1}, crowd:72, text:"My calendar and I are taking some time apart. It kept bringing up my dates." },
  { id:"w1", tags:{wordplay:3,wholesome:1}, crowd:67, text:"I opened a bakery for introverts. Our specialty is turnovers — handed over with minimal eye contact." },
  { id:"o1", tags:{observational:3,dry:1}, crowd:75, text:"Nothing makes you question your entire personality like hearing your recorded voice say ‘sounds good!’" },
  { id:"d1", tags:{dark:2,dry:2}, crowd:62, text:"I finally achieved work–life balance. They are now equally concerned about me." },
  { id:"a2", tags:{absurd:3,wholesome:1}, crowd:70, text:"A pigeon nodded at me today. Nice to finally get approval from upper management." },
  { id:"w2", tags:{wordplay:3,dry:1}, crowd:65, text:"My thesaurus is terrible. Not only that, it’s terrible." },
  { id:"o2", tags:{observational:3,dark:1}, crowd:73, text:"The self-checkout said ‘unexpected item.’ Honestly, same — but my therapist charges more." },
  { id:"h1", tags:{wholesome:3,absurd:1}, crowd:64, text:"My dog has no job, no savings, and sleeps all day. Still, somehow, an inspirational speaker." },
  { id:"d2", tags:{dark:3,wordplay:1}, crowd:59, text:"My five-year plan is now old enough to start asking difficult questions." },
  { id:"o3", tags:{observational:2,wordplay:1}, crowd:69, text:"‘Password must contain a special character.’ Fine. Here’s my uncle Gary." },
  { id:"a3", tags:{absurd:2,dry:2}, crowd:68, text:"The moon controls the tides and still finds time to look decorative. Overachiever." },
  { id:"h2", tags:{wholesome:2,wordplay:2}, crowd:63, text:"I told my houseplants I believe in them. The fern asked for that in writing." },
  { id:"a4", tags:{absurd:3,observational:1}, crowd:71, text:"A Roomba is just a tiny landlord inspecting the floor and refusing to fix anything." },
  { id:"w3", tags:{wordplay:3,dry:1}, crowd:66, text:"I joined a support group for procrastinators. We haven't met yet." },
  { id:"o4", tags:{observational:3,dry:1}, crowd:76, text:"Every group chat has a historian who replies to a three-day-old message like the investigation just reopened." },
  { id:"d3", tags:{dark:2,observational:2}, crowd:64, text:"My screen-time report arrives every Sunday like a tiny digital intervention nobody invited." },
  { id:"h3", tags:{wholesome:3,absurd:1}, crowd:65, text:"I waved back at someone who wasn't waving at me. We're both in witness protection now." },
  { id:"a5", tags:{absurd:3,dry:1}, crowd:69, text:"The printer can smell urgency. That's why it asks what cyan is at the funeral." },
  { id:"w4", tags:{wordplay:3,wholesome:1}, crowd:64, text:"My lamp and I have a healthy relationship. It gives me space, and I let it lighten up." },
  { id:"o5", tags:{observational:3,wordplay:1}, crowd:74, text:"Online recipes begin with a childhood memory because the onions need time to emotionally prepare." },
  { id:"d4", tags:{dark:3,dry:1}, crowd:61, text:"I keep an emergency contact so two people can be surprised at once." },
  { id:"h4", tags:{wholesome:3,observational:1}, crowd:68, text:"Dogs hear a snack wrapper from three rooms away but somehow miss the phrase ‘please stop barking.’" },
  { id:"a6", tags:{absurd:2,wordplay:2}, crowd:67, text:"My GPS said ‘recalculating’ with the exact tone my parents use when I describe my career." },
  { id:"w5", tags:{wordplay:2,dark:1,dry:1}, crowd:63, text:"I bought a planner to get my life in order. It's now a beautifully bound list of allegations." }
];

export function scoreJoke(joke, profile={}, ratings={}) {
  const affinity = Object.entries(joke.tags).reduce((sum,[tag,weight]) => sum + (profile[tag] || 0) * weight, 0);
  return joke.crowd / 20 + affinity + (ratings[joke.id] || 0);
}

export function selectPair(profile={}, seen=[], round=0, ratings={}, random=Math.random) {
  const available = jokes.filter(j => !seen.includes(j.id));
  if (available.length < 2) return [];
  const ranked = available.map(j => ({j, score:scoreJoke(j,profile,ratings)})).sort((a,b)=>b.score-a.score);
  const pick = candidates => candidates[Math.min(Math.floor(random()*candidates.length), candidates.length-1)];
  // Randomness within the strongest candidates keeps repeat visits fresh without
  // abandoning the profile and crowd signals that make later rounds adaptive.
  const firstEntry = pick(ranked.slice(0,Math.min(6,ranked.length)));
  const first = firstEntry.j;
  const contrasting = ranked.filter(({j})=>j.id!==first.id).sort((a,b) => {
    const overlapA = Object.keys(a.j.tags).filter(t=>first.tags[t]).length;
    const overlapB = Object.keys(b.j.tags).filter(t=>first.tags[t]).length;
    return overlapA - overlapB || b.score-a.score;
  });
  const second = pick(contrasting.slice(0,Math.min(4,contrasting.length))).j;
  return [first,second];
}

export function applyChoice(profile, winner, loser) {
  const next={...profile};
  Object.entries(winner.tags).forEach(([tag,w]) => next[tag]=(next[tag]||0)+w);
  Object.entries(loser.tags).forEach(([tag,w]) => next[tag]=(next[tag]||0)-w*.25);
  return next;
}

export function topTraits(profile) { return Object.keys(dimensions).sort((a,b)=>(profile[b]||0)-(profile[a]||0)).slice(0,3); }

export function encodeProfile(profile) { return btoa(JSON.stringify(profile)).replaceAll("+","-").replaceAll("/","_").replaceAll("=",""); }
export function decodeProfile(value) { try { return JSON.parse(atob(value.replaceAll("-","+").replaceAll("_","/"))); } catch { return null; } }
