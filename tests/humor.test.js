import test from "node:test";
import assert from "node:assert/strict";
import { jokes, selectPair, applyChoice, topTraits, encodeProfile, decodeProfile } from "../humor.js";

test("first pair varies while always containing two different jokes",()=>{ const first=selectPair({},[],0,{},()=>0); const next=selectPair({},[],0,{},()=>.99); assert.equal(first.length,2); assert.notEqual(first[0].id,first[1].id); assert.notDeepEqual(first.map(j=>j.id),next.map(j=>j.id)); });
test("adaptive pairs exclude seen jokes",()=>{ const seen=[jokes[0].id,jokes[1].id]; const pair=selectPair({absurd:3},seen,1,{}); assert.ok(pair.every(j=>!seen.includes(j.id))); });
test("refinement rounds never repeat a previously offered joke",()=>{ let seen=[]; let profile={}; for(let round=0;round<12;round++){ const pair=selectPair(profile,seen,round,{},()=>.5); assert.equal(pair.length,2); assert.ok(pair.every(j=>!seen.includes(j.id))); profile=applyChoice(profile,pair[0],pair[1]); seen.push(...pair.map(j=>j.id)); } assert.equal(new Set(seen).size,24); });
test("a choice strengthens the winner traits",()=>{ const profile=applyChoice({},jokes[0],jokes[1]); assert.ok(profile.absurd>0); assert.ok(profile.wordplay<0); assert.equal(topTraits(profile)[0],"absurd"); });
test("profiles survive URL-safe serialization",()=>{ const profile={absurd:3,dry:1.5}; assert.deepEqual(decodeProfile(encodeProfile(profile)),profile); });
