import { defineConfig,loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig(({mode})=>{
  const env=loadEnv(mode,process.cwd(),'');
  return {plugins:[vue()],server:{strictPort:true,...(env.VITE_ACCOUNT_RECORDS==='true'?{proxy:{'/api':env.API_TARGET||'http://127.0.0.1:3000'}}:{})}};
});
