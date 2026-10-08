import 'reflect-metadata';
import {NestFactory} from '@nestjs/core';
import {DocumentBuilder,SwaggerModule} from '@nestjs/swagger';
import {writeFile} from 'node:fs/promises';
import {AppModule} from './app.js';
import {contracts} from './contracts.js';
const app=await NestFactory.create(AppModule,{logger:false});
const doc=contracts(SwaggerModule.createDocument(app,new DocumentBuilder().setTitle('Focus Coins API').setVersion('1.0').addBearerAuth().build()));
await writeFile('../../packages/client/openapi.json',JSON.stringify(doc,null,2));await app.close();
