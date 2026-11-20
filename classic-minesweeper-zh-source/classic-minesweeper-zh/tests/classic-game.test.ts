import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { it,expect } from 'vitest';
function harness() {
  const source=readFileSync(new URL('../public/classic-minesweeper/js/minesweeper.js',import.meta.url),'utf8');
  const touchHandlers:Record<string,(event:any)=>void>={};
  const jq=()=>{const chain:any={off:()=>chain,on:(event:string,fn:(event:any)=>void)=>{touchHandlers[event]=fn;return chain;},closest:()=>chain,hasClass:()=>false,data:()=> '2,2'};return chain;};
  const context:any={location:{search:'',protocol:'file:'},URLSearchParams,window:{SweeperOSEnvironment:{},get localStorage(){throw new Error('storage denied');}},console,performance:{now:()=>5000},clearInterval(){},clearTimeout(){},setInterval(){},setTimeout(){},crypto:{getRandomValues:(v:Uint8Array)=>v.fill(1)},$:jq,touchHandlers};
  vm.createContext(context);
  const expose=`window.test={setup:function(w,h,mines,flags){boardWidth=w;boardHeight=h;tiles=[];tilesLeft=w*h-mines.length;gameOver=false;gameWaiting=false;noMoves=true;maxMines=mines.length;minesLeft=maxMines-flags.length;startedAt=0;difficulty=4;for(var r=0;r<h;r++){tiles[r]=[];for(var c=0;c<w;c++)tiles[r][c]=new Tile();}mines.forEach(function(p){mine(p[0],p[1]);setNumbers(p[0],p[1]);});flags.forEach(function(p){tiles[p[0]][p[1]].flagged=true;});},trigger:trigger,apply:applyModeAt,chord:chordAt,mode:function(value){inputMode=value;},touch:function(kind,event){rebindEvents();touchHandlers[kind].call({},event);},state:function(){return {tiles:tiles,left:tilesLeft,over:gameOver,minesLeft:minesLeft};},read:getLocalStorageValue,write:setLocalStorageValue};digitRender=function(){};rerender=function(){};winGame=function(){gameOver=true;};explode=function(){gameOver=true;};getRandomNumber=function(min,max){return Math.min(1,max);};`;
  vm.runInContext(source.replace(/\}\)\(\);\s*$/,expose+'})();'),context);
  return context.window.test;
}
it('opens a large empty area iteratively without stack overflow or duplicate decrement',()=>{
  const game=harness();game.setup(60,40,[[0,0]],[]);game.trigger(39,59);expect(game.state().left).toBe(0);expect(game.state().over).toBe(true);expect(game.state().tiles[0][0].triggered).toBe(false);
});
it('relocates a first-click mine and respects flagged cells',()=>{
  const game=harness();game.setup(3,3,[[0,0]],[[2,2]]);game.trigger(0,0);expect(game.state().tiles[0][0].isMine).toBe(false);expect(game.state().tiles[1][1].isMine).toBe(true);expect(game.state().over).toBe(false);game.trigger(2,2);expect(game.state().tiles[2][2].triggered).toBe(false);
});
it('continues playing when browser storage is denied',()=>{const game=harness();expect(game.read('lvl')).toBe(null);expect(()=>game.write('lvl',1)).not.toThrow();});
it('placing a correct flag waits for a click on the matching number',()=>{
  const game=harness();game.setup(3,3,[[0,0]],[]);game.trigger(1,1);expect(game.state().left).toBe(7);game.apply(0,0,'flag');expect(game.state().left).toBe(7);expect(game.state().over).toBe(false);game.apply(1,1,'reveal');expect(game.state().left).toBe(0);expect(game.state().over).toBe(true);expect(game.state().tiles[0][0].triggered).toBe(false);
});
it('explodes if a matching flag count conceals the wrong cell',()=>{
  const game=harness();game.setup(3,3,[[0,0]],[]);game.trigger(1,1);game.apply(0,1,'flag');expect(game.state().over).toBe(false);game.apply(1,1,'flag');expect(game.state().over).toBe(true);expect(game.state().tiles[0][0].triggered).toBe(true);
});
it('does not expand without flags or when the flag count is too low or too high',()=>{
  const game=harness();game.setup(3,3,[[0,0],[0,2]],[]);game.trigger(1,1);const before=game.state().left;game.chord(1,1);expect(game.state().left).toBe(before);game.apply(0,0,'flag');expect(game.state().left).toBe(before);
  game.setup(3,3,[[0,0],[0,2]],[[0,0],[0,2],[2,0]]);game.trigger(1,1);game.chord(1,1);expect(game.state().left).toBe(before);expect(game.state().over).toBe(false);
});
it('explicit flag and question modes toggle only the selected mark and keep the counter correct',()=>{
  const game=harness();game.setup(3,3,[[0,0]],[]);game.apply(2,2,'flag');expect(game.state().minesLeft).toBe(0);game.apply(2,2,'question');expect(game.state().tiles[2][2].flagged).toBe(false);expect(game.state().tiles[2][2].marked).toBe(true);expect(game.state().minesLeft).toBe(1);game.apply(2,2,'question');expect(game.state().tiles[2][2].marked).toBe(false);expect(game.state().tiles[2][2].triggered).toBe(false);
});
it('touch release follows the selected mode once and suppresses the synthetic mouse event',()=>{
  const game=harness();game.setup(3,3,[[0,0]],[]);game.mode('flag');const point={identifier:7,clientX:10,clientY:10};
  game.touch('touchstart',{originalEvent:{touches:[point]}});let prevented=false;const end={originalEvent:{touches:[],changedTouches:[point]},preventDefault(){prevented=true;}};
  game.touch('touchend',end);game.touch('touchend',end);expect(prevented).toBe(true);expect(game.state().tiles[2][2].flagged).toBe(true);expect(game.state().minesLeft).toBe(0);
});
it('scrolling and multi-touch cancel a pending tile action',()=>{
  const game=harness();game.setup(3,3,[[0,0]],[]);game.mode('flag');const point={identifier:7,clientX:10,clientY:10};
  game.touch('touchstart',{originalEvent:{touches:[point]}});game.touch('touchmove',{originalEvent:{touches:[{...point,clientX:30}]}});game.touch('touchend',{originalEvent:{touches:[],changedTouches:[point]},preventDefault(){}});expect(game.state().tiles[2][2].flagged).toBe(false);
  game.touch('touchstart',{originalEvent:{touches:[point,point]}});game.touch('touchend',{originalEvent:{touches:[],changedTouches:[point]},preventDefault(){}});expect(game.state().tiles[2][2].flagged).toBe(false);
});



