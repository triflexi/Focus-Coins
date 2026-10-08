import {Body,Controller,Get,Headers,Inject,Param,Patch,Post,Query,Req,Res,UnauthorizedException,BadRequestException} from '@nestjs/common';
import {ApiBearerAuth,ApiBody,ApiHeader,ApiOperation,ApiTags} from '@nestjs/swagger';
import type {Request,Response} from 'express';
import {z} from 'zod';
import {Auth} from './auth.js';
import {Economy} from './economy.js';
const nickname=z.string().regex(/^[\p{L}\p{N}_.-]{3,24}$/u,'Никнейм: 3–24 буквы, цифры, _, . или -');
const password=z.string().min(8,'Пароль: минимум 8 символов').max(128);
const login=z.string().regex(/^[a-zA-Z0-9_.-]{3,32}$/,'Логин: 3–32 латинские буквы, цифры, _, . или -');
function parse<T>(schema:z.ZodType<T>,body:unknown):T{const r=schema.safeParse(body);if(!r.success)throw new BadRequestException(r.error.issues.map(i=>i.message).join('; '));return r.data;}
const idem=()=>ApiHeader({name:'Idempotency-Key',required:true});
@ApiTags('Focus Coins')
@ApiBearerAuth()
@Controller('api/v1')
export class Api {
  constructor(@Inject(Auth) readonly auth:Auth,@Inject(Economy) readonly economy:Economy){}
  private origin(req:Request){if(req.headers.origin&&req.headers.origin!==process.env.WEB_ORIGIN)throw new UnauthorizedException('Недопустимый источник запроса');}
  private tokens(req:Request,res:Response,tokens:{accessToken:string;refreshToken:string}){res.cookie('fc_refresh',tokens.refreshToken,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/v1/auth',maxAge:30*86400_000});return {accessToken:tokens.accessToken,...(req.headers['x-client']==='android'?{refreshToken:tokens.refreshToken}:{})};}
  @Post('auth/register') @ApiOperation({summary:'Регистрация'}) @ApiBody({schema:{type:'object',required:['login','password','nickname'],properties:{login:{type:'string'},password:{type:'string'},nickname:{type:'string'}}}})
  async register(@Body() body:unknown,@Req() req:Request,@Res({passthrough:true}) res:Response){this.origin(req);return this.tokens(req,res,await this.auth.register(parse(z.object({login,password,nickname}),body)));}
  @Post('auth/login') @ApiOperation({summary:'Вход'}) @ApiBody({schema:{type:'object',required:['login','password'],properties:{login:{type:'string'},password:{type:'string'}}}})
  async login(@Body() body:unknown,@Req() req:Request,@Res({passthrough:true}) res:Response){this.origin(req);const p=parse(z.object({login,password:z.string().max(128)}),body);return this.tokens(req,res,await this.auth.login(p.login,p.password));}
  @Post('auth/refresh') async refresh(@Body() body:unknown,@Req() req:Request,@Res({passthrough:true}) res:Response){this.origin(req);const p=parse(z.object({refreshToken:z.string().optional()}),body??{});const token=req.headers['x-client']==='android'?p.refreshToken:req.cookies.fc_refresh;if(!token)throw new UnauthorizedException();return this.tokens(req,res,await this.auth.refresh(token));}
  @Post('auth/logout') async logout(@Body() body:unknown,@Req() req:Request,@Res({passthrough:true}) res:Response){this.origin(req);const p=parse(z.object({refreshToken:z.string().optional()}),body??{});res.clearCookie('fc_refresh',{path:'/api/v1/auth'});return this.auth.logout(req.headers['x-client']==='android'?p.refreshToken:req.cookies.fc_refresh);}
  @Get('dashboard') dashboard(@Headers('authorization') token:string){return this.economy.dashboard(this.auth.user(token));}
  @Get('leaderboard') leaderboard(@Headers('authorization') token:string,@Query('season') season?:string){return this.economy.leaderboard(this.auth.user(token),season);}
  @Post('focus') @idem() @ApiBody({schema:{type:'object',required:['minutes'],properties:{minutes:{type:'integer',minimum:1,maximum:360}}}})
  start(@Headers('authorization') token:string,@Headers('idempotency-key') key:string,@Body() body:unknown){return this.economy.start(this.auth.user(token),key,parse(z.object({minutes:z.number().int().min(1).max(360)}),body).minutes);}
  @Post('focus/:id/cancel') @idem() cancel(@Headers('authorization') token:string,@Headers('idempotency-key') key:string,@Param('id') id:string){return this.economy.cancel(this.auth.user(token),key,id);}
  @Post('games/:kind') @idem() @ApiBody({schema:{type:'object',required:['stake'],properties:{stake:{type:'string',pattern:'^\\d+(\\.\\d{1,2})?$'},bet:{type:'object',properties:{type:{type:'string',enum:['red','black','even','odd','number']},number:{type:'integer',minimum:0,maximum:36}}}}}})
  play(@Headers('authorization') token:string,@Headers('idempotency-key') key:string,@Param('kind') kind:string,@Body() body:unknown){const game=parse(z.enum(['roulette','wheel','tower']),kind),p=parse(z.object({stake:z.string(),bet:z.object({type:z.enum(['red','black','even','odd','number']),number:z.number().int().min(0).max(36).optional()}).optional()}),body);if(game==='roulette'&&(!p.bet||(p.bet.type==='number'&&p.bet.number===undefined)))throw new BadRequestException('Выберите ставку');return this.economy.play(this.auth.user(token),key,game,p);}
  @Post('tower/:id/pick') @idem() @ApiBody({schema:{type:'object',required:['cell'],properties:{cell:{type:'integer',minimum:0,maximum:3}}}})
  pick(@Headers('authorization') token:string,@Headers('idempotency-key') key:string,@Param('id') id:string,@Body() body:unknown){return this.economy.towerAction(this.auth.user(token),key,id,parse(z.object({cell:z.number().int().min(0).max(3)}),body).cell);}
  @Post('tower/:id/collect') @idem() collect(@Headers('authorization') token:string,@Headers('idempotency-key') key:string,@Param('id') id:string){return this.economy.towerAction(this.auth.user(token),key,id,null);}
  @Patch('profile') @ApiBody({schema:{type:'object',required:['nickname'],properties:{nickname:{type:'string'}}}}) profile(@Headers('authorization') token:string,@Body() body:unknown){return this.auth.nickname(this.auth.user(token),parse(z.object({nickname}),body).nickname);}
  @Post('profile/password') changePassword(@Headers('authorization') token:string,@Body() body:unknown){const p=parse(z.object({current:z.string().max(128),next:password}),body);return this.auth.password(this.auth.user(token),p.current,p.next);}
  @Post('visits') visit(@Headers('authorization') token:string){return this.economy.visit(this.auth.user(token));}
}
