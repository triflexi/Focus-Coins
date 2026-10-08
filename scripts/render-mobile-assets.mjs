import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
// Render the original local SVG assets without changing their vector content.
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({deviceScaleFactor:3});
const page=await context.newPage();
await mkdir('apps/mobile/assets',{recursive:true});
const slots={coin:'2-146-imgFrame',timer:'2-150-imgFrame3',stats:'2-146-imgFrame3',games:'2-146-imgFrame2',rating:'2-146-imgFrame1',profile:'2-146-imgFrame5',timerLight:'13-1537-imgFrame1',statsLight:'13-1537-imgFrame2',gamesLight:'13-1537-imgFrame3',ratingLight:'13-1537-imgFrame4',profileLight:'13-1537-imgFrame5',timerActive:'2-146-imgFrame4',statsActive:'2-149-imgFrame4',gamesActive:'2-150-imgFrame4',ratingActive:'2-154-imgFrame5',profileActive:'2-155-imgFrame6',rouletteDetail:'2-151-img37',wheelDetail:'2-152-img',roulette:'2-150-img37',wheel:'2-150-img',tower:'2-150-img1'};
for(const [name,file]of Object.entries(slots)){await page.goto(`http://127.0.0.1:5173/assets/${file}.svg`);await page.locator('svg').screenshot({path:`apps/mobile/assets/${name}.png`,omitBackground:true});}
await browser.close();console.log('Original Figma assets rendered for native Image');
