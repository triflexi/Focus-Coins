import {BadRequestException,ConflictException,Inject,Injectable,NotFoundException} from '@nestjs/common';
import {Interval} from '@nestjs/schedule';
import {Prisma,GameRound,FocusSession} from '@prisma/client';
import {createHash,randomInt} from 'node:crypto';
import {cents,money,dayKey,previousDay,seasonKey,seasonBounds,nextStreak,DAILY_REWARDS,rouletteMultiplier,wheelMultiplier,towerPayout,Dashboard,RouletteBet} from '@focus/core';
import {Database} from './prisma.js';
type Tx=Prisma.TransactionClient;
export function sessionView(s:FocusSession){return {...s,startedAt:s.startedAt.toISOString(),endsAt:s.endsAt.toISOString(),reward:money(s.reward),multiplier:s.multiplier/100};}
export function roundView(r:GameRound){return {id:r.id,kind:r.kind,stake:money(r.stake),payout:money(r.payout),net:money(r.payout-r.stake),status:r.status,result:r.result,floors:r.floors,picks:r.picks,expiresAt:r.expiresAt.toISOString(),createdAt:r.createdAt.toISOString()};}
@Injectable()
export class Economy {
  constructor(@Inject(Database) readonly db:Database){}
  now=()=>new Date();
  draw=(max:number)=>randomInt(max);
  private running=false;
  @Interval(5000) async tick(){if(this.running)return;this.running=true;try{await this.transaction(async()=>null);}catch(e){console.error('Scheduler failed',e);}finally{this.running=false;}}
  // One PostgreSQL advisory lock serializes economic operations across API replicas.
  // Read committed takes fresh snapshots AFTER the lock has been acquired.
  async transaction<T>(fn:(tx:Tx,now:Date)=>Promise<T>):Promise<T>{return this.db.$transaction(async tx=>{await tx.$queryRaw`SELECT pg_advisory_xact_lock(72412026)::text`;const now=this.now();await this.reconcile(tx,now);return fn(tx,now);},{maxWait:15000,timeout:30000});}
  async season(tx:Tx,date:Date){const key=seasonKey(date),b=seasonBounds(key);return tx.season.upsert({where:{key},create:{key,startsAt:b.start,endsAt:b.end},update:{}});}
  async wallet(tx:Tx,userId:string,key:string){return tx.wallet.upsert({where:{userId_seasonKey:{userId,seasonKey:key}},create:{userId,seasonKey:key},update:{}});}
  async credit(tx:Tx,userId:string,key:string,amount:bigint,kind:string,reference:string,at:Date){await this.wallet(tx,userId,key);await tx.ledger.create({data:{userId,seasonKey:key,amount,kind,reference,createdAt:at}});await tx.wallet.update({where:{userId_seasonKey:{userId,seasonKey:key}},data:{balance:{increment:amount}}});}
  async reconcile(tx:Tx,now:Date){
    const sessions=await tx.focusSession.findMany({where:{status:'active',endsAt:{lte:now}},orderBy:[{endsAt:'asc'},{id:'asc'}]});
    for(const s of sessions){
      const season=await this.season(tx,s.endsAt),reward=BigInt(s.minutes*s.multiplier);
      await tx.focusSession.update({where:{id:s.id},data:{status:'completed',reward}});
      await this.credit(tx,s.userId,season.key,reward,'focus',`focus:${s.id}`,s.endsAt);
      const day=dayKey(s.endsAt),start=new Date(`${day}T00:00:00+05:00`),end=new Date(start.getTime()+86400_000);
      const sum=await tx.focusSession.aggregate({where:{userId:s.userId,status:'completed',endsAt:{gte:start,lt:end}},_sum:{minutes:true}});
      if((sum._sum.minutes??0)>=25&&!await tx.dailyReward.findUnique({where:{userId_day:{userId:s.userId,day}}})){
        const u=await tx.user.findUniqueOrThrow({where:{id:s.userId}}),streak=nextStreak(u.lastRewardDay,day,u.streak),cycle=(streak-1)%7+1,amount=BigInt(DAILY_REWARDS[cycle-1])*100n;
        await tx.dailyReward.create({data:{userId:s.userId,day,cycle,amount,createdAt:s.endsAt}});
        await this.credit(tx,s.userId,season.key,amount,'bonus',`daily:${s.userId}:${day}`,s.endsAt);
        await tx.user.update({where:{id:s.userId},data:{streak,lastRewardDay:day,...(cycle===7?{boostUntil:new Date(s.endsAt.getTime()+86400_000)}:{})}});
      }
    }
    const towers=await tx.gameRound.findMany({where:{status:'active'}});
    for(const r of towers){const boundary=seasonBounds(r.seasonKey).end;const expiry=r.expiresAt<boundary?r.expiresAt:boundary;if(expiry<=now)await this.finishTower(tx,r,towerPayout(r.stake,r.floors),'collected',expiry);}
    const old=await tx.season.findMany({where:{closedAt:null,endsAt:{lte:now}},orderBy:{key:'asc'}});
    for(const s of old){const rows=await this.ranking(tx,s.key);for(const r of rows)await tx.seasonResult.create({data:{userId:r.userId,nickname:r.nickname,seasonKey:s.key,balance:r.amount,rank:r.rank}});await tx.season.update({where:{key:s.key},data:{closedAt:now}});}
    await this.season(tx,now);
  }
  async ranking(tx:Tx,key:string){
    const wallets=await tx.wallet.findMany({where:{seasonKey:key}}),users=await tx.user.findMany({select:{id:true,nickname:true}}),names=new Map(users.map(u=>[u.id,u.nickname]));
    const rows=wallets.map(w=>({userId:w.userId,nickname:names.get(w.userId)??'Удалённый пользователь',amount:w.balance+w.reserved,rank:0})).sort((a,b)=>a.amount===b.amount?a.nickname.localeCompare(b.nickname,'ru'):a.amount>b.amount?-1:1);
    rows.forEach((r,i)=>{r.rank=i>0&&r.amount===rows[i-1].amount?rows[i-1].rank:i+1;});return rows;
  }
  async command(userId:string,key:string|undefined,action:string,input:unknown,fn:(tx:Tx,now:Date)=>Promise<any>){
    if(!key||key.length<8||key.length>120)throw new BadRequestException('Нужен Idempotency-Key (8–120 символов)');
    const fingerprint=createHash('sha256').update(JSON.stringify({action,input})).digest('hex');
    return this.transaction(async(tx,now)=>{const prev=await tx.idempotency.findUnique({where:{userId_key:{userId,key}}});if(prev){if(prev.fingerprint!==fingerprint)throw new ConflictException('Ключ уже использован для другого запроса');return prev.response;}
      const response=await fn(tx,now);await tx.idempotency.create({data:{userId,key,fingerprint,response:JSON.parse(JSON.stringify(response))}});return response;});
  }
  async start(userId:string,key:string|undefined,minutes:number){return this.command(userId,key,'focus/start',{minutes},async(tx,now)=>{
    if(await tx.focusSession.findFirst({where:{userId,status:'active'}}))throw new ConflictException('Сессия уже идёт на одном из устройств');
    const u=await tx.user.findUniqueOrThrow({where:{id:userId}});return sessionView(await tx.focusSession.create({data:{userId,minutes,multiplier:u.boostUntil&&u.boostUntil>now?150:100,startedAt:now,endsAt:new Date(now.getTime()+minutes*60000)}}));});}
  async cancel(userId:string,key:string|undefined,id:string){return this.command(userId,key,'focus/cancel',{id},async tx=>{const s=await tx.focusSession.findFirst({where:{id,userId}});if(!s)throw new NotFoundException('Сессия не найдена');if(s.status!=='active')throw new ConflictException('Сессия уже закончилась');return sessionView(await tx.focusSession.update({where:{id},data:{status:'cancelled'}}));});}
  async play(userId:string,key:string|undefined,kind:'roulette'|'wheel'|'tower',input:{stake:string;bet?:RouletteBet}){return this.command(userId,key,kind,input,async(tx,now)=>{
    let stake:bigint;try{stake=cents(input.stake);}catch(e){throw new BadRequestException((e as Error).message);}if(stake<100n)throw new BadRequestException('Минимальная ставка — 1 монета');
    if(kind==='tower'&&await tx.gameRound.findFirst({where:{userId,status:'active'}}))throw new ConflictException('У вас уже есть активная башня');
    const season=await this.season(tx,now),w=await this.wallet(tx,userId,season.key);if(stake>w.balance)throw new BadRequestException('Недостаточно монет');
    let result:Prisma.InputJsonValue={},payout=0n;
    if(kind==='roulette'){const number=this.draw(37),bet=input.bet!;let multiplier:number;try{multiplier=rouletteMultiplier(bet,number);}catch(e){throw new BadRequestException((e as Error).message);}result={number,multiplier,bet:bet as unknown as Prisma.InputJsonValue};payout=stake*BigInt(multiplier);}
    if(kind==='wheel'){const draw=this.draw(100),multiplier=wheelMultiplier(draw);result={draw,multiplier};payout=stake*BigInt(multiplier);}
    const r=await tx.gameRound.create({data:{userId,seasonKey:season.key,kind,stake,payout,status:kind==='tower'?'active':'completed',result,hazards:kind==='tower'?Array.from({length:8},()=>this.draw(4)):[],picks:[],createdAt:now,expiresAt:new Date(now.getTime()+900000)}});
    await this.credit(tx,userId,season.key,-stake,'stake',`stake:${r.id}`,now);
    if(kind==='tower')await tx.wallet.update({where:{id:w.id},data:{reserved:{increment:stake}}});else await this.credit(tx,userId,season.key,payout,'payout',`payout:${r.id}`,now);
    return roundView(r);});}
  async finishTower(tx:Tx,r:GameRound,payout:bigint,status:string,now:Date){await tx.wallet.update({where:{userId_seasonKey:{userId:r.userId,seasonKey:r.seasonKey}},data:{reserved:{decrement:r.stake}}});await this.credit(tx,r.userId,r.seasonKey,payout,'payout',`payout:${r.id}`,now);return tx.gameRound.update({where:{id:r.id},data:{payout,status}});}
  async towerAction(userId:string,key:string|undefined,id:string,cell:number|null){return this.command(userId,key,'tower/action',{id,cell},async(tx,now)=>{
    let r=await tx.gameRound.findFirst({where:{id,userId,kind:'tower'}});if(!r)throw new NotFoundException('Раунд не найден');if(r.status!=='active')throw new ConflictException('Раунд уже завершён');
    if(cell===null){if(r.floors===0)throw new BadRequestException('Сначала выберите клетку');return roundView(await this.finishTower(tx,r,towerPayout(r.stake,r.floors),'collected',now));}
    const safe=cell!==r.hazards[r.floors];r=await tx.gameRound.update({where:{id},data:{picks:{push:cell},floors:r.floors+(safe?1:0),expiresAt:new Date(now.getTime()+900000),result:{safe,cell,floor:r.floors+1}}});
    if(!safe)r=await this.finishTower(tx,r,0n,'lost',now);else if(r.floors===8)r=await this.finishTower(tx,r,towerPayout(r.stake,8),'collected',now);return roundView(r);});}
  async dashboard(userId:string):Promise<Dashboard>{return this.transaction(async(tx,now)=>{
    const u=await tx.user.findUniqueOrThrow({where:{id:userId}}),season=await this.season(tx,now),w=await this.wallet(tx,userId,season.key),all=await tx.focusSession.findMany({where:{userId},orderBy:{endsAt:'desc'}}),rounds=await tx.gameRound.findMany({where:{userId},orderBy:{createdAt:'desc'},take:100}),ledger=await tx.ledger.findMany({where:{userId,seasonKey:season.key},orderBy:{createdAt:'desc'}});
    const today=dayKey(now),completed=all.filter(s=>s.status==='completed'),days=Array.from({length:31},(_,i)=>{const day=dayKey(new Date(now.getTime()-(30-i)*86400_000));return {day,minutes:completed.filter(s=>dayKey(s.endsAt)===day).reduce((n,s)=>n+s.minutes,0)};}),daily=await tx.dailyReward.findUnique({where:{userId_day:{userId,day:today}}}),streak=u.lastRewardDay===today||u.lastRewardDay===previousDay(today)?u.streak:0;
    const sum=(kind:string)=>ledger.filter(l=>l.kind===kind).reduce((n,l)=>n+l.amount,0n),rank=(await this.ranking(tx,season.key)).find(r=>r.userId===userId)?.rank??1;
    return {serverTime:now.toISOString(),user:{id:u.id,login:u.login,nickname:u.nickname,createdAt:u.createdAt.toISOString()},season:{key:season.key,endsAt:season.endsAt.toISOString()},balance:money(w.balance),reserved:money(w.reserved),rankingBalance:money(w.balance+w.reserved),rank,active:all.find(s=>s.status==='active')?sessionView(all.find(s=>s.status==='active')!):null,history:all.slice(0,30).map(sessionView),rounds:rounds.map(roundView),tower:rounds.find(r=>r.status==='active')?roundView(rounds.find(r=>r.status==='active')!):null,daily:{minutes:days[30].minutes,streak,cycle:daily?.cycle??streak%7+1,awarded:!!daily,boostUntil:u.boostUntil?.toISOString()??null},stats:{totalMinutes:completed.reduce((n,s)=>n+s.minutes,0),weekMinutes:days.slice(-7).reduce((n,d)=>n+d.minutes,0),monthMinutes:completed.filter(s=>seasonKey(s.endsAt)===season.key).reduce((n,s)=>n+s.minutes,0),completed:completed.length,cancelled:all.filter(s=>s.status==='cancelled').length,focusCoins:money(sum('focus')),bonusCoins:money(sum('bonus')),gameNet:money(sum('stake')+sum('payout')+w.reserved),days},ledger:ledger.slice(0,30).map(l=>({id:l.id,kind:l.kind,amount:money(l.amount),createdAt:l.createdAt.toISOString()}))};});}
  async leaderboard(userId:string,key?:string){return this.transaction(async(tx,now)=>{const current=seasonKey(now),season=key??current;if(!/^\d{4}-\d{2}$/.test(season))throw new BadRequestException('Неверный сезон');const archive=season!==current;const rows=archive?(await tx.seasonResult.findMany({where:{seasonKey:season},orderBy:[{rank:'asc'},{nickname:'asc'}]})).map(r=>({...r,amount:r.balance})) : await this.ranking(tx,season);const view=(r:typeof rows[number])=>({userId:r.userId,nickname:r.nickname,balance:money(r.amount),rank:r.rank});return {season,rows:rows.slice(0,100).map(view),self:rows.find(r=>r.userId===userId)?view(rows.find(r=>r.userId===userId)!):null,archives:(await tx.season.findMany({where:{closedAt:{not:null}},orderBy:{key:'desc'}})).map(s=>s.key)};});}
  async visit(userId:string){return this.transaction(async(tx,now)=>{const prev=await tx.visit.findUnique({where:{userId}}),newVisit=!prev||now.getTime()-prev.lastActivity.getTime()>=1800000;await tx.visit.upsert({where:{userId},create:{userId,lastActivity:now},update:{lastActivity:now,...(newVisit?{count:{increment:1}}:{})}});return {counted:newVisit};});}
}
