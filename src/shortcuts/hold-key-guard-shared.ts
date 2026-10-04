// Shared between the hold-key guard and its hook thread; no native imports here.

export const SLOT = {
  ACTIVE: 0,
  SCAN: 1,
  EXTENDED: 2,
  MODIFIERS: 3,
  THREAD_ID: 4,
} as const;
export const SLOT_COUNT = 5;

export const LLKHF_EXTENDED = 0x01;
export const LLKHF_INJECTED = 0x10;

/** Sided modifier virtual-key codes. */
export const VK = {
  LSHIFT: 0xa0,
  RSHIFT: 0xa1,
  LCONTROL: 0xa2,
  RCONTROL: 0xa3,
  LMENU: 0xa4,
  RMENU: 0xa5,
  LWIN: 0x5b,
  RWIN: 0x5c,
} as const;

/** One bit per physically held modifier, keyed by virtual-key code. */
export const MODIFIER_BITS: Record<number, number> = {
  [VK.LCONTROL]: 1 << 0,
  [VK.RCONTROL]: 1 << 1,
  [VK.LSHIFT]: 1 << 2,
  [VK.RSHIFT]: 1 << 3,
  [VK.LMENU]: 1 << 4,
  [VK.RMENU]: 1 << 5,
  [VK.LWIN]: 1 << 6,
  [VK.RWIN]: 1 << 7,
};

/** Modifiers whose virtual-key event needs the extended-key flag. */
export const EXTENDED_VKS = new Set<number>([VK.RCONTROL, VK.RMENU, VK.LWIN, VK.RWIN]);

/** Alt and Win act on a lone release (menu bar, Start menu); a dummy key in between cancels that. */
export const MENU_VKS = new Set<number>([VK.LMENU, VK.RMENU, VK.LWIN, VK.RWIN]);

/** uiohook keycodes are scan codes; extended keys carry 0x0E00 (or 0xE000 for the arrows). */
export function uiohookToScan(keycode: number): { scan: number; extended: boolean } {
  const prefix = keycode & 0xff00;
  return { scan: keycode & 0xff, extended: prefix === 0x0e00 || prefix === 0xe000 };
}

/** Sided modifier virtual-key codes set in a MODIFIER_BITS mask. */
export function modifiersInMask(mask: number): number[] {
  return Object.entries(MODIFIER_BITS)
    .filter(([, bit]) => mask & bit)
    .map(([vk]) => Number(vk));
}
