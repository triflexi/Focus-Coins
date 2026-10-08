import {useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Easing,Image,Platform,StyleSheet,Text,View,type LayoutChangeEvent} from 'react-native';
import type {Round} from '@focus/core';

interface NativeWheelProps {
  kind:'roulette'|'wheel';
  result:Round|null;
  /** Release the caller's input lock after the saved result has been revealed. */
  onComplete?:()=>void;
}

const EUROPEAN_ORDER=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const normalize=(angle:number)=>(angle%360+360)%360;
// Static requires let Metro include the unchanged Figma artwork in the APK.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const images={roulette:require('./assets/rouletteDetail.png'),wheel:require('./assets/wheelDetail.png')};

function landingAngle(kind:NativeWheelProps['kind'],round:Round):number|null {
  if(round.kind!==kind)return null;
  const result=(round.result??{}) as {number?:number;draw?:number};
  if(kind==='roulette'){
    const index=EUROPEAN_ORDER.indexOf(result.number??-1);
    return index<0?null:normalize(-(index+.5)*360/37);
  }
  const draw=result.draw;
  return typeof draw==='number'&&Number.isInteger(draw)&&draw>=0&&draw<100?normalize(-(draw+.5)*3.6):null;
}

/** Only the stored Round sets the destination; the client never draws a result. */
export function NativeWheel({kind,result,onComplete}:NativeWheelProps){
  const [size,setSize]=useState(280),[motion,setMotion]=useState({ready:false,reduced:true}),[spinning,setSpinning]=useState(false),[shown,setShown]=useState<Round|null>(null);
  const rotation=useRef(new Animated.Value(0)).current,appearance=useRef(new Animated.Value(1)).current;
  const animation=useRef<Animated.CompositeAnimation|null>(null),fade=useRef<Animated.CompositeAnimation|null>(null),generation=useRef(0),completed=useRef<string|null>(null),callback=useRef(onComplete);
  callback.current=onComplete;
  const roundId=result?.kind===kind?result.id:null;

  useEffect(()=>{
    let alive=true,changed=false;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced=>{if(alive&&!changed)setMotion({ready:true,reduced});}).catch(()=>{if(alive&&!changed)setMotion({ready:true,reduced:true});});
    const subscription=AccessibilityInfo.addEventListener('reduceMotionChanged',reduced=>{changed=true;if(alive)setMotion({ready:true,reduced});});
    return()=>{alive=false;subscription.remove();};
  },[]);

  useEffect(()=>{
    const token=++generation.current;
    animation.current?.stop();fade.current?.stop();
    if(!roundId||!result||result.kind!==kind){
      completed.current=null;rotation.setValue(0);appearance.setValue(1);setShown(null);setSpinning(false);
      return()=>{generation.current++;animation.current?.stop();fade.current?.stop();};
    }
    if(!motion.ready)return;
    if(completed.current===roundId){appearance.setValue(1);return;}
    const target=landingAngle(kind,result);
    const complete=(withFade:boolean)=>{
      if(token!==generation.current||completed.current===roundId)return;
      rotation.setValue(target??0);completed.current=roundId;setSpinning(false);setShown(result);
      appearance.setValue(withFade?0:1);
      if(withFade){fade.current=Animated.timing(appearance,{toValue:1,duration:180,easing:Easing.out(Easing.cubic),useNativeDriver:true});fade.current.start();}
      callback.current?.();
    };
    // Malformed data cannot leave the caller locked; the server's textual
    // result can still be displayed, without pretending to choose a pocket.
    if(target===null||motion.reduced){complete(false);return;}
    setSpinning(true);appearance.setValue(1);
    rotation.stopAnimation(current=>{
      if(token!==generation.current)return;
      const destination=current+1440+normalize(target-normalize(current));
      animation.current=Animated.timing(rotation,{toValue:destination,duration:kind==='roulette'?3400:3200,easing:Easing.bezier(.12,.64,.18,1),useNativeDriver:true});
      animation.current.start(({finished})=>{if(finished)complete(true);});
    });
    return()=>{generation.current++;animation.current?.stop();fade.current?.stop();rotation.stopAnimation();};
  // A saved round is immutable. Repeated dashboard objects with the same ID
  // must not restart a spin or invoke onComplete again.
  },[kind,roundId,motion.ready,motion.reduced,rotation,appearance]);

  const layout=(event:LayoutChangeEvent)=>{const width=Math.min(event.nativeEvent.layout.width,280);if(width>0&&Math.abs(width-size)>.5)setSize(width);};
  const nativeSize=kind==='roulette'?258:340,stroke=size*3/nativeSize,patchWidth=size*.06;
  const transform=rotation.interpolate({inputRange:[0,360],outputRange:['0deg','360deg'],extrapolate:'extend'});
  const shownOutcome=(shown?.result??{}) as {number?:number;multiplier?:number};
  const shownValue=kind==='roulette'?typeof shownOutcome.number==='number'?String(shownOutcome.number):'—':typeof shownOutcome.multiplier==='number'?`×${shownOutcome.multiplier}`:'—';
  const centre=spinning?'···':shown?shownValue:kind==='roulette'?'0–36':'× ?';
  const label=kind==='roulette'?'Европейская рулетка, числа от 0 до 36.':'Колесо: ×0 — 50%, ×1 — 30%, ×2 — 15%, ×5 — 4%, ×15 — 1%.';
  const announcement=spinning?'Колесо вращается.':shown?shownValue==='—'?'Результат сохранён.':kind==='roulette'?`Выпало ${shownOutcome.number}.`:`Множитель ${shownOutcome.multiplier}.`:'';

  return <View style={styles.wrapper} onLayout={layout}>
    <View style={[styles.stage,{width:size,height:size}]} accessible accessibilityRole="image" accessibilityLabel={`${label} ${announcement}`} accessibilityState={{busy:spinning}} accessibilityLiveRegion="polite">
      <View style={[styles.clip,{left:size*.08,top:size*.08,width:size*.84,height:size*.84,borderRadius:size*.42}]}>
        <Animated.View style={[styles.disc,{left:-size*.08,top:-size*.08,width:size,height:size,transform:[{rotate:transform}]}]}>
          <Image source={images[kind]} style={{position:'absolute',left:0,top:0,width:size,height:size}} resizeMode="contain" accessible={false}/>
          {kind==='roulette'&&<>
            <View style={[styles.patch,{left:size*.47,top:size*.08,width:patchWidth,height:size*.0325}]}>
              <View style={[styles.patchPart,{left:0,width:(patchWidth-stroke)/2,backgroundColor:'#25323c'}]}/>
              <View style={[styles.patchPart,{left:(patchWidth-stroke)/2,width:stroke,backgroundColor:'#101d24'}]}/>
              <View style={[styles.patchPart,{right:0,width:(patchWidth-stroke)/2,backgroundColor:'#236649'}]}/>
            </View>
            {EUROPEAN_ORDER.map((number,index)=>{
              const angle=(index+.5)*360/37,radians=angle*Math.PI/180;
              return <Text key={number} allowFontScaling={false} style={[styles.pocket,{left:size*(.5+.34*Math.sin(radians)-.03),top:size*(.5-.34*Math.cos(radians)-.025),width:size*.06,height:size*.05,fontSize:size*10/258,lineHeight:size*12/258,transform:[{rotate:`${angle}deg`}]}]}>{number}</Text>;
            })}
          </>}
        </Animated.View>
      </View>
      <View pointerEvents="none" style={[styles.rim,{left:size*.08,top:size*.08,width:size*.84,height:size*.84,borderRadius:size*.42,borderWidth:stroke}]}/>
      <View pointerEvents="none" style={[styles.pointer,{left:size*(.5-12/nativeSize),top:size*5/nativeSize,borderLeftWidth:size*12/nativeSize,borderRightWidth:size*12/nativeSize,borderTopWidth:size*23/nativeSize}]}/>
      <View pointerEvents="none" style={[styles.centre,{left:size*.37,top:size*.37,width:size*.26,height:size*.26}]}>
        <Animated.Text allowFontScaling={false} style={[styles.value,{fontSize:size*(kind==='roulette'?18/258:24/340),lineHeight:size*.1,opacity:spinning?1:appearance}]}>{centre}</Animated.Text>
      </View>
    </View>
  </View>;
}

const styles=StyleSheet.create({
  wrapper:{width:'100%',alignItems:'center'},
  stage:{position:'relative',overflow:'hidden'},
  clip:{position:'absolute',overflow:'hidden'},
  disc:{position:'absolute'},
  patch:{position:'absolute'},
  patchPart:{position:'absolute',top:0,bottom:0},
  rim:{position:'absolute',borderColor:'#7d909c'},
  pointer:{position:'absolute',width:0,height:0,borderLeftColor:'transparent',borderRightColor:'transparent',borderTopColor:'#f4cf70',zIndex:2},
  pocket:{position:'absolute',color:'#f0f3eb',fontFamily:Platform.OS==='android'?'monospace':undefined,fontWeight:'500',textAlign:'center',includeFontPadding:false,textShadowColor:'#09131c',textShadowOffset:{width:0,height:1},textShadowRadius:1},
  centre:{position:'absolute',alignItems:'center',justifyContent:'center'},
  value:{color:'#14232b',fontFamily:Platform.OS==='android'?'monospace':undefined,fontWeight:'700',fontVariant:['tabular-nums'],textAlign:'center',includeFontPadding:false},
});
