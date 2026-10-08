import {Image,View} from 'react-native';
export type NativeIcon='coin'|'timer'|'stats'|'games'|'rating'|'profile';
const icons={coin:require('./assets/coin.png'),timer:require('./assets/timer.png'),stats:require('./assets/stats.png'),games:require('./assets/games.png'),rating:require('./assets/rating.png'),profile:require('./assets/profile.png')};
const activeIcons={coin:icons.coin,timer:require('./assets/timerActive.png'),stats:require('./assets/statsActive.png'),games:require('./assets/gamesActive.png'),rating:require('./assets/ratingActive.png'),profile:require('./assets/profileActive.png')};
const lightIcons={coin:icons.coin,timer:require('./assets/timerLight.png'),stats:require('./assets/statsLight.png'),games:require('./assets/gamesLight.png'),rating:require('./assets/ratingLight.png'),profile:require('./assets/profileLight.png')};
export const gameImages={roulette:require('./assets/roulette.png'),wheel:require('./assets/wheel.png'),tower:require('./assets/tower.png')};
export function NativeIcon({name,size=28,active=false,light=false}:{name:NativeIcon;size?:number;active?:boolean;light?:boolean}){return <View style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}><Image source={(active?activeIcons:light?lightIcons:icons)[name]} style={{width:size*26/28,height:size}} resizeMode="contain"/></View>;}
