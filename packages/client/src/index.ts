import type {RouletteBet} from '@focus/core';
import type {components} from './generated/api.js';
type Dashboard=components['schemas']['Dashboard'];
type Round=components['schemas']['Round'];
type Session=components['schemas']['Session'];
export type Leaderboard=components['schemas']['Leaderboard'];
type Tokens={accessToken:string;refreshToken?:string};
export class ApiClient {
  accessToken='';private refreshing:Promise<void>|null=null;
  constructor(readonly baseUrl='/api/v1',readonly storage?:{get:()=>Promise<string|null>;set:(token:string|null)=>Promise<void>}){}
  async request<T>(path:string,method='GET',body?:unknown,key?:string,retry=true):Promise<T>{
    const r=await fetch(`${this.baseUrl}${path}`,{method,credentials:this.storage?'omit':'include',headers:{'Content-Type':'application/json',...(this.storage?{'X-Client':'android'}:{}),...(this.accessToken?{Authorization:`Bearer ${this.accessToken}`} :{}),...(key?{'Idempotency-Key':key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(r.status===401&&retry&&!path.startsWith('/auth/')){await this.restore();return this.request(path,method,body,key,false);}
    if(!r.ok){const err=await r.json().catch(()=>({message:'Сервер недоступен'}));throw new Error(Array.isArray(err.message)?err.message.join('; '):err.message??'Ошибка запроса');}return r.json();
  }
  async accept(t:Tokens){this.accessToken=t.accessToken;if(this.storage&&t.refreshToken)await this.storage.set(t.refreshToken);}
  async restore(){if(this.refreshing)return this.refreshing;this.refreshing=(async()=>{const refreshToken=await this.storage?.get();await this.accept(await this.request<Tokens>('/auth/refresh','POST',refreshToken?{refreshToken}:{},undefined,false));})();try{await this.refreshing;}finally{this.refreshing=null;}}
  async login(login:string,password:string){await this.accept(await this.request<Tokens>('/auth/login','POST',{login,password}));}
  async register(login:string,nickname:string,password:string){await this.accept(await this.request<Tokens>('/auth/register','POST',{login,nickname,password}));}
  async logout(){const refreshToken=await this.storage?.get();await this.request('/auth/logout','POST',refreshToken?{refreshToken}:{});this.accessToken='';await this.storage?.set(null);}
  dashboard(){return this.request<Dashboard>('/dashboard');}
  leaderboard(season?:string){return this.request<Leaderboard>(`/leaderboard${season?`?season=${encodeURIComponent(season)}`:''}`);}
  start(minutes:number,key:string){return this.request<Session>('/focus','POST',{minutes},key);}
  cancel(id:string,key:string){return this.request<Session>(`/focus/${id}/cancel`,'POST',{},key);}
  play(kind:string,stake:string,key:string,bet?:RouletteBet){return this.request<Round>(`/games/${kind}`,'POST',{stake,...(bet?{bet}:{})},key);}
  pick(id:string,cell:number,key:string){return this.request<Round>(`/tower/${id}/pick`,'POST',{cell},key);}
  collect(id:string,key:string){return this.request<Round>(`/tower/${id}/collect`,'POST',{},key);}
  profile(nickname:string){return this.request('/profile','PATCH',{nickname});}
  password(current:string,next:string){return this.request('/profile/password','POST',{current,next});}
  visit(){return this.request('/visits','POST',{});}
}
