const {withAndroidManifest,withAppBuildGradle}=require('expo/config-plugins');
module.exports=config=>withAppBuildGradle(withAndroidManifest(config,mod=>{
  const url=process.env.EXPO_PUBLIC_API_URL??'http://10.0.2.2:3000/api/v1';
  // Allow HTTP only for a local development API, never a public production host.
  const local=/^http:\/\/(10\.0\.2\.2|127\.0\.0\.1|localhost|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:|\/)/.test(url);
  mod.modResults.manifest.application[0].$['android:usesCleartextTraffic']=String(local);
  // Focus sessions are user-visible timers. Android 13+ grants USE_EXACT_ALARM;
  // Android 12 uses the earlier permission, without requesting both on new OSes.
  for(const permission of mod.modResults.manifest['uses-permission']??[]){
    if(permission.$['android:name']==='android.permission.SCHEDULE_EXACT_ALARM')permission.$['android:maxSdkVersion']='32';
  }
  return mod;
}),mod=>{
  // The React Native Gradle plugin otherwise detects the workspace root.
  if(!/^\s*root = file\("\.\.\/\.\.\/"\)/m.test(mod.modResults.contents))mod.modResults.contents=mod.modResults.contents.replace('react {','react {\n    root = file("../../")');
  return mod;
});
