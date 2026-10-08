import {BadRequestException,Inject,Injectable,UnauthorizedException} from '@nestjs/common';
import {hash,verify,argon2id} from 'argon2';
import jwt from 'jsonwebtoken';
import {randomBytes,createHash} from 'node:crypto';
import {Database} from './prisma.js';
import {Economy} from './economy.js';
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
@Injectable()
export class Auth {
  constructor(@Inject(Database) readonly db:Database,@Inject(Economy) readonly economy:Economy){}
  async register(input:{login:string;nickname:string;password:string}){
    const passwordHash=await hash(input.password,{type:argon2id,memoryCost:19456,timeCost:2,parallelism:1});
    let u;try{u=await this.economy.transaction(async(tx,now)=>{const user=await tx.user.create({data:{login:input.login.toLowerCase(),nickname:input.nickname,passwordHash}});const s=await this.economy.season(tx,now);await this.economy.wallet(tx,user.id,s.key);return user;});}catch(e){if((e as any).code==='P2002')throw new BadRequestException('Логин или никнейм уже занят');throw e;}
    return this.issue(u.id);
  }
  async login(login:string,password:string){const u=await this.db.user.findUnique({where:{login:login.toLowerCase()}});if(!u){await hash(password,{type:argon2id,memoryCost:19456,timeCost:2});throw new UnauthorizedException('Неверный логин или пароль');}if(!await verify(u.passwordHash,password))throw new UnauthorizedException('Неверный логин или пароль');return this.issue(u.id);}
  async issue(userId:string){const refreshToken=randomBytes(48).toString('base64url');await this.db.refreshToken.create({data:{userId,hash:digest(refreshToken),expiresAt:new Date(Date.now()+30*86400_000)}});return {accessToken:jwt.sign({sub:userId},process.env.JWT_SECRET!,{expiresIn:'15m',issuer:'focus-coins',audience:'focus-coins'}),refreshToken};}
  user(token:string|undefined):string {if(!token?.startsWith('Bearer '))throw new UnauthorizedException('Войдите в аккаунт');try{const payload=jwt.verify(token.slice(7),process.env.JWT_SECRET!,{issuer:'focus-coins',audience:'focus-coins'}) as jwt.JwtPayload;if(!payload.sub)throw new Error();return payload.sub;}catch{throw new UnauthorizedException('Срок входа истёк');}}
  async refresh(token:string){const h=digest(token),r=await this.db.refreshToken.findUnique({where:{hash:h}});if(!r||r.revokedAt||r.expiresAt<new Date())throw new UnauthorizedException('Войдите снова');const changed=await this.db.refreshToken.updateMany({where:{hash:h,revokedAt:null,expiresAt:{gt:new Date()}},data:{revokedAt:new Date()}});if(!changed.count)throw new UnauthorizedException('Токен уже обновлён');return this.issue(r.userId);}
  async logout(token:string|undefined){if(token)await this.db.refreshToken.updateMany({where:{hash:digest(token),revokedAt:null},data:{revokedAt:new Date()}});return {ok:true};}
  async nickname(userId:string,nickname:string){try{await this.db.user.update({where:{id:userId},data:{nickname}});}catch(e){if((e as any).code==='P2002')throw new BadRequestException('Никнейм занят');throw e;}return {ok:true};}
  async password(userId:string,current:string,next:string){const u=await this.db.user.findUniqueOrThrow({where:{id:userId}});if(!await verify(u.passwordHash,current))throw new UnauthorizedException('Неверный текущий пароль');const passwordHash=await hash(next,{type:argon2id,memoryCost:19456,timeCost:2});await this.db.$transaction([this.db.user.update({where:{id:userId},data:{passwordHash}}),this.db.refreshToken.updateMany({where:{userId,revokedAt:null},data:{revokedAt:new Date()}})]);return {ok:true};}
}
