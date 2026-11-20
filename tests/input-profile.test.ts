import { it,expect } from 'vitest';
import { useTouchControls } from '../src/input-profile.js';
it('keeps mouse controls on a desktop even in a narrow window',()=>{
  expect(useTouchControls(1440,false,true)).toBe(false);
  expect(useTouchControls(390,false,true)).toBe(false);
});
it('shows touch controls on phones in portrait and landscape',()=>{
  expect(useTouchControls(390,true,false)).toBe(true);
  expect(useTouchControls(844,true,false)).toBe(true);
  expect(useTouchControls(768,false,false)).toBe(true);
});
