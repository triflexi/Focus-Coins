import {test,expect} from '@playwright/test';
import type {Dashboard,Round} from '@focus/core';

test('a tower settled by the server stops offering moves and shows the saved payout',async({page})=>{
  const now=new Date().toISOString();
  const round:Round={id:'timeout-round',kind:'tower',stake:'1.00',payout:'0.00',net:'-1.00',status:'active',result:{},floors:0,picks:[],expiresAt:now,createdAt:now};
  const data:Dashboard={serverTime:now,user:{id:'timeout-user',login:'timeout_user',nickname:'timeout_user',createdAt:now},season:{key:'2026-10',endsAt:'2026-10-31T19:00:00Z'},balance:'10.00',reserved:'0.00',rankingBalance:'10.00',rank:1,active:null,history:[],rounds:[],tower:null,daily:{minutes:0,streak:0,cycle:1,awarded:false,boostUntil:null},stats:{totalMinutes:0,weekMinutes:0,monthMinutes:0,completed:0,cancelled:0,focusCoins:'0.00',bonusCoins:'0.00',gameNet:'0.00',days:[]},ledger:[]};
  await page.route('**/api/v1/**',async route=>{
    const endpoint=new URL(route.request().url()).pathname;
    let response:unknown={ok:true};
    if(endpoint.endsWith('/auth/refresh'))response={accessToken:'browser-fixture-token'};
    if(endpoint.endsWith('/dashboard'))response={...data,serverTime:new Date().toISOString()};
    if(endpoint.endsWith('/games/tower')){data.tower=round;data.rounds=[round];data.balance='9.00';data.reserved='1.00';response=round;}
    await route.fulfill({contentType:'application/json',body:JSON.stringify(response)});
  });
  await page.goto('/#games');await page.getByRole('heading',{name:'Монеты в игре'}).waitFor();
  await page.locator('.panel').filter({has:page.getByText('БАШНЯ',{exact:true})}).getByRole('button',{name:'Открыть игру'}).click();
  await page.getByLabel('Размер ставки',{exact:true}).fill('1');
  await page.getByRole('button',{name:/^Начать ·/}).click();
  await expect(page.getByRole('button',{name:/^Забрать /})).toBeDisabled();
  const settled={...round,status:'collected',payout:'1.00',net:'0.00'};data.tower=null;data.rounds=[settled];data.balance='10.00';data.reserved='0.00';
  await expect(page.getByRole('button',{name:/^Начать ·/})).toBeEnabled({timeout:10000});
  await expect(page.getByRole('button',{name:/^Забрать /})).toHaveCount(0);
  await expect(page.locator('.game-result')).toContainText('Выплата 1,00 · результат 0,00');
  await page.setViewportSize({width:390,height:844});await page.locator('.game-result').scrollIntoViewIfNeeded();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);
  await page.screenshot({path:'artifacts/tower-auto-settled-web.png'});
});
