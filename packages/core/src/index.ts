export const TIME_ZONE = 'Asia/Yekaterinburg';
export const DAILY_REWARDS = [10,15,20,25,30,40,50] as const;
export const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
export const WHEEL = [{chance:50,multiplier:0},{chance:30,multiplier:1},{chance:15,multiplier:2},{chance:4,multiplier:5},{chance:1,multiplier:15}] as const;
export type RouletteBet = {type:'red'|'black'|'even'|'odd'|'number';number?:number};
export function cents(value:string):bigint {
  if(!/^\d{1,12}(\.\d{1,2})?$/.test(value)) throw new Error('Укажите сумму с точностью до сотой');
  const [whole,fraction=''] = value.split('.');
  return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
}
export function money(value:bigint):string {const sign=value<0n?'-':'';const n=value<0n?-value:value;return `${sign}${n/100n}.${String(n%100n).padStart(2,'0')}`;}
export function dayKey(date:Date):string {return new Date(date.getTime()+5*3600_000).toISOString().slice(0,10);}
export function previousDay(day:string):string {return new Date(Date.parse(day+'T00:00:00Z')-86400_000).toISOString().slice(0,10);}
export function seasonKey(date:Date):string {return dayKey(date).slice(0,7);}
export function seasonBounds(key:string):{start:Date;end:Date} {const [y,m]=key.split('-').map(Number);return {start:new Date(Date.UTC(y,m-1,1)-5*3600_000),end:new Date(Date.UTC(y,m,1)-5*3600_000)};}
export function rouletteMultiplier(bet:RouletteBet,n:number):number {
  if(!Number.isInteger(n)||n<0||n>36)throw new Error('Invalid roulette result');
  if(bet.type==='number'){if(!Number.isInteger(bet.number)||bet.number!<0||bet.number!>36)throw new Error('Выберите число 0–36');return bet.number===n?36:0;}
  if(n===0)return 0;
  return (bet.type==='red'?RED_NUMBERS.includes(n):bet.type==='black'?!RED_NUMBERS.includes(n):bet.type==='even'?n%2===0:bet.type==='odd'?n%2===1:false)?2:0;
}
export function wheelMultiplier(draw:number):number {if(!Number.isInteger(draw)||draw<0||draw>=100)throw new Error('Invalid wheel draw');let limit=0;for(const s of WHEEL){limit+=s.chance;if(draw<limit)return s.multiplier;}throw new Error('Unreachable');}
export function towerPayout(stake:bigint,floors:number):bigint {if(!Number.isInteger(floors)||floors<0||floors>8)throw new Error('Invalid floor');if(floors===0)return stake;return stake*95n*4n**BigInt(floors)/(100n*3n**BigInt(floors));}
export function nextStreak(last:string|null,current:string,streak:number):number {return last===previousDay(current)?streak+1:1;}
export interface Session {id:string;minutes:number;startedAt:string;endsAt:string;status:string;reward:string;multiplier:number}
export interface Round {id:string;kind:string;stake:string;payout:string;net:string;status:string;result:any;floors:number;picks:number[];expiresAt:string;createdAt:string}
export interface Dashboard {serverTime:string;user:{id:string;login:string;nickname:string;createdAt:string};season:{key:string;endsAt:string};balance:string;reserved:string;rankingBalance:string;rank:number;active:Session|null;history:Session[];rounds:Round[];tower:Round|null;daily:{minutes:number;streak:number;cycle:number;awarded:boolean;boostUntil:string|null};stats:{totalMinutes:number;weekMinutes:number;monthMinutes:number;completed:number;cancelled:number;focusCoins:string;bonusCoins:string;gameNet:string;days:{day:string;minutes:number}[]};ledger:{id:string;kind:string;amount:string;createdAt:string}[]}
