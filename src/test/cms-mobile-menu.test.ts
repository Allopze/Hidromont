import { describe, expect, it, vi } from 'vitest';
import { createMobileMenuController } from '../scripts/cms/mobile-menu';

function classList() {
  const values = new Set<string>();
  return {
    add: (value: string) => values.add(value),
    remove: (value: string) => values.delete(value),
    contains: (value: string) => values.has(value),
  };
}

describe('CMS mobile menu controller', () => {
  it('opens accessibly and returns focus after Escape', () => {
    const launcher = {
      setAttribute: vi.fn(),
      focus: vi.fn(),
    };
    const sheet = { classList: classList(), setAttribute: vi.fn() };
    const controller = createMobileMenuController({ launcher, sheet });

    controller.open();
    expect(sheet.classList.contains('open')).toBe(true);
    expect(launcher.setAttribute).toHaveBeenLastCalledWith('aria-expanded', 'true');
    expect(sheet.setAttribute).toHaveBeenLastCalledWith('aria-hidden', 'false');

    expect(controller.handleKeydown({ key: 'Escape' })).toBe(true);
    expect(sheet.classList.contains('open')).toBe(false);
    expect(launcher.setAttribute).toHaveBeenLastCalledWith('aria-expanded', 'false');
    expect(sheet.setAttribute).toHaveBeenLastCalledWith('aria-hidden', 'true');
    expect(launcher.focus).toHaveBeenCalledOnce();
  });
});
