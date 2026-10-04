import { UiohookKey } from 'uiohook-napi';
import { MODIFIER_BITS, VK, modifiersInMask, uiohookToScan } from '../hold-key-guard-shared';

describe('uiohookToScan', () => {
  test('letters map to their plain scan code', () => {
    expect(uiohookToScan(UiohookKey.X)).toEqual({ scan: 0x2d, extended: false });
    expect(uiohookToScan(UiohookKey.Z)).toEqual({ scan: 0x2c, extended: false });
  });

  test('extended keys keep their scan code and set the extended flag', () => {
    expect(uiohookToScan(UiohookKey.Insert)).toEqual({ scan: 0x52, extended: true });
    expect(uiohookToScan(UiohookKey.ArrowUp)).toEqual({ scan: 0x48, extended: true });
  });
});

describe('modifiersInMask', () => {
  test('returns the sided keys whose bits are set', () => {
    const mask = MODIFIER_BITS[VK.LCONTROL] | MODIFIER_BITS[VK.RSHIFT];
    expect(modifiersInMask(mask).sort()).toEqual([VK.RSHIFT, VK.LCONTROL].sort());
  });

  test('an empty mask lifts nothing', () => {
    expect(modifiersInMask(0)).toEqual([]);
  });

  test('every modifier has its own bit', () => {
    const bits = Object.values(MODIFIER_BITS);
    expect(new Set(bits).size).toBe(bits.length);
  });
});
