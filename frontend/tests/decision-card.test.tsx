// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {DecisionCard} from '../src/decision-card';
import {defaultDecisionCriteria,evaluateDecision} from '../src/decision-card-data';
import type {Listing} from '../src/listings-data';

const item:Listing={id:'test',type:'condo',city:'Montréal',district:'Ville-Marie',postal:'H3H 0B1',aliases:'',price:500000,beds:2,baths:1,area:743,parking:true,outdoor:null,image:'/photo.jpg',date:'2026-10-23',mode:'broker',real:true};
let root:ReturnType<typeof createRoot>|undefined;
afterEach(async()=>{if(root)await act(async()=>root!.unmount());root=undefined;document.body.innerHTML='';});

describe('decision card evidence',()=>{
  it('compares transaction-specific asking prices without using a sale price as monthly rent',()=>{
    const both={...item,transaction:'sale-rent' as const,rentPrice:2100};
    expect(evaluateDecision(both,{transaction:'rent',max:'2200'},'en').facts.find(fact=>fact.key==='budget')?.status).toBe('match');
    expect(evaluateDecision(both,{transaction:'rent',max:'2000'},'en').facts.find(fact=>fact.key==='budget')?.status).toBe('mismatch');
    expect(evaluateDecision({...both,rentPrice:null},{transaction:'rent',max:'2200'},'en').facts.find(fact=>fact.key==='budget')?.status).toBe('unknown');
    const saleOnly=evaluateDecision(item,{transaction:'rent',max:'600000'},'en');
    expect(saleOnly.facts.find(fact=>fact.key==='transaction')?.status).toBe('mismatch');
    expect(saleOnly.facts.find(fact=>fact.key==='budget')?.status).toBe('unknown');
    expect(defaultDecisionCriteria({...item,transaction:'rent'}).transaction).toBe('rent');
  });

  it('keeps unknown facts separate from confirmed zero or negative values',()=>{
    const unknown=evaluateDecision({...item,beds:null,parking:null,area:null},{beds:'2',parking:true},'en');
    expect(unknown.facts.filter(fact=>fact.status==='unknown').map(fact=>fact.key)).toEqual(['beds','parking','area']);
    const confirmed=evaluateDecision({...item,beds:0,parking:false,parkingSpaces:0},{beds:'2',parking:true},'en');
    expect(confirmed.facts.filter(fact=>fact.status==='mismatch').map(fact=>fact.key)).toEqual(['beds','parking']);
    expect(evaluateDecision({...item,parking:true,parkingSpaces:0},{parking:true},'en').facts.find(fact=>fact.key==='parking')?.status).toBe('unknown');
    expect(evaluateDecision({...item,price:0},{max:'600000'},'en').facts.find(fact=>fact.key==='budget')?.status).toBe('unknown');
  });

  it('does not count street parking as the requested on-site space or hotel beds as residential bedrooms',()=>{
    const street=evaluateDecision({...item,parking:false,parkingSpaces:0,streetParking:true},{parking:true},'fr');
    expect(street.facts.find(fact=>fact.key==='parking')).toMatchObject({status:'mismatch'});
    const hotel=evaluateDecision({...item,type:'hotel-motel',beds:0,area:null},{beds:'3'},'en');
    expect(hotel.facts.some(fact=>fact.key==='beds'||fact.key==='area')).toBe(false);
    expect(hotel.questions.join(' ')).toContain('operating records');
    expect(hotel.questions.join(' ')).not.toContain('bedrooms');
    const land=evaluateDecision({...item,type:'land',area:12000,lotArea:null},{},'zh');
    expect(land.facts.find(fact=>fact.key==='lotArea')?.status).toBe('unknown');
    expect(evaluateDecision({...item,type:'land',lotArea:12000},{},'zh').facts.some(fact=>fact.key==='lotArea')).toBe(false);
  });

  it('hands only visitor-selected, visible questions to the existing enquiry action',async()=>{
    const onAsk=vi.fn();document.body.innerHTML='<div id="test"></div>';root=createRoot(document.getElementById('test')!);
    await act(async()=>root!.render(<DecisionCard lang="en" item={item} initialCriteria={{max:'550000',beds:'3'}} onAsk={onAsk}/>));
    expect(document.querySelector('.decision-mismatch')?.textContent).toContain('Below your minimum bedroom count');
    expect(document.querySelector('.decision-match')?.textContent).toContain('Within your asking-price budget');
    const questions=[...document.querySelectorAll<HTMLInputElement>('.decision-questions input')];
    const skipped=questions[0].closest('label')!.textContent!;
    await act(async()=>questions[0].click());
    await act(async()=>document.querySelector<HTMLButtonElement>('.decision-action button')!.click());
    expect(onAsk).toHaveBeenCalledOnce();
    expect(onAsk.mock.calls[0][0]).not.toContain(skipped);
    expect(onAsk.mock.calls[0][0]).toHaveLength(questions.length-1);
    for(const question of onAsk.mock.calls[0][0])expect(document.querySelector('.decision-questions')?.textContent).toContain(question);
  });
});
