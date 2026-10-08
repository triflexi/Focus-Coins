import {Controller,Get,Inject,Module,Res,ServiceUnavailableException} from '@nestjs/common';
import {ScheduleModule} from '@nestjs/schedule';
import type {Response} from 'express';
import {Registry,collectDefaultMetrics,Gauge,Histogram} from 'prom-client';
import {Database} from './prisma.js';
import {Auth} from './auth.js';
import {Economy} from './economy.js';
import {Api} from './controller.js';
export const registry=new Registry();collectDefaultMetrics({register:registry});
export const requestDuration=new Histogram({name:'app_http_request_duration_seconds',help:'API requests',labelNames:['method','route','status'],registers:[registry],buckets:[.01,.05,.1,.3,1,3,10]});
const visits=new Gauge({name:'app_visits_total',help:'Persisted visits',registers:[registry]}),completed=new Gauge({name:'app_focus_sessions_total',help:'Completed focus sessions',registers:[registry]}),minutes=new Gauge({name:'app_focus_minutes_total',help:'Completed minutes',registers:[registry]}),rounds=new Gauge({name:'app_game_rounds_total',help:'Game rounds',registers:[registry]});
@Controller()
class Health {
  constructor(@Inject(Database) readonly db:Database){}
  @Get('health/live') live(){return {status:'ok'};}
  @Get('health/ready') async ready(){try{await this.db.$queryRaw`SELECT 1`;return {status:'ok'};}catch{throw new ServiceUnavailableException('Database unavailable');}}
  @Get('metrics') async metrics(@Res() res:Response){const [v,f,g]=await Promise.all([this.db.visit.aggregate({_sum:{count:true}}),this.db.focusSession.aggregate({where:{status:'completed'},_sum:{minutes:true},_count:true}),this.db.gameRound.count()]);visits.set(v._sum.count??0);completed.set(f._count);minutes.set(f._sum.minutes??0);rounds.set(g);res.type(registry.contentType).send(await registry.metrics());}
}
@Module({imports:[ScheduleModule.forRoot()],providers:[Database,Economy,Auth],controllers:[Api,Health]})
export class AppModule {}
