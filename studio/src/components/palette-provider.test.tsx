import { act, render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PALETTE_ATTRIBUTE, PALETTE_STORAGE_KEY } from "@/lib/palettes";
import { memoryStorage } from "@/test/memory-storage";
import { PaletteProvider, usePalette } from "./palette-provider";

const KEY = PALETTE_STORAGE_KEY;
const attr = () => document.documentElement.getAttribute(PALETTE_ATTRIBUTE);

/**
 * The palette preference is GLOBAL and persisted (the useShowToolCalls
 * contract): it round-trips through localStorage, keeps two mounted instances
 * in sync, stores nothing while it equals the deployment default, and an
 * unknown / removed stored id resolves to that default. Setting it also
 * lands `data-palette` on <html> at once — the picker must not wait for a
 * reload.
 */
describe("usePalette (shipped default)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });
  afterEach(() => {
    document.documentElement.removeAttribute(PALETTE_ATTRIBUTE);
  });

  it("defaults to the shipped palette and stores nothing", () => {
    const { result } = renderHook(() => usePalette());
    expect(result.current.palette).toBe("default");
    expect(result.current.defaultPalette).toBe("default");
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("round-trips a choice across mounts and applies the attribute", () => {
    const first = renderHook(() => usePalette());
    act(() => first.result.current.setPalette("aztec"));
    expect(first.result.current.palette).toBe("aztec");
    expect(window.localStorage.getItem(KEY)).toBe("aztec");
    expect(attr()).toBe("aztec");
    first.unmount();

    // A reload (fresh mount) reads it back.
    const second = renderHook(() => usePalette());
    expect(second.result.current.palette).toBe("aztec");

    // Back to the default removes the key AND the attribute rather than
    // storing "default" forever.
    act(() => second.result.current.setPalette("default"));
    expect(second.result.current.palette).toBe("default");
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(attr()).toBeNull();
  });

  it("resolves an unknown or removed stored id to the default", () => {
    window.localStorage.setItem(KEY, "midnight");
    const { result } = renderHook(() => usePalette());
    expect(result.current.palette).toBe("default");
    // And refuses to set one — the catalogue is the grammar.
    act(() => result.current.setPalette("midnight"));
    expect(result.current.palette).toBe("default");
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(attr()).toBeNull();
  });

  it("keeps two mounted instances in sync (picker + provider)", () => {
    const picker = renderHook(() => usePalette());
    const provider = renderHook(() => usePalette());
    act(() => picker.result.current.setPalette("mono"));
    expect(provider.result.current.palette).toBe("mono");
    expect(picker.result.current.palette).toBe("mono");
  });

  it("follows a change made in another tab", () => {
    const { result } = renderHook(() => usePalette());
    expect(result.current.palette).toBe("default");
    window.localStorage.setItem(KEY, "solar");
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: KEY, newValue: "solar" }),
      );
    });
    expect(result.current.palette).toBe("solar");
  });
});

/**
 * With an operator pin (`BRAND_PALETTE`), the deployment default is the
 * fallback everywhere: nothing stored → the pin; choosing the pin stores
 * nothing (so a later change of the pin still reaches this browser); and an
 * explicit different choice — the shipped default included — is stored so
 * it sticks.
 */
describe("usePalette under a PaletteProvider default pin", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <PaletteProvider defaultPalette="mono">{children}</PaletteProvider>
  );

  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });
  afterEach(() => {
    document.documentElement.removeAttribute(PALETTE_ATTRIBUTE);
  });

  it("applies the pin on mount when nothing is stored", () => {
    const { result } = renderHook(() => usePalette(), { wrapper });
    expect(result.current.palette).toBe("mono");
    expect(result.current.defaultPalette).toBe("mono");
    // PaletteInit's layout effect put it on <html> (the boot script's job
    // on a real page load; here the dev-remount / soft-navigation path).
    expect(attr()).toBe("mono");
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("stores an explicit choice of the shipped default and removes the attribute", () => {
    const { result } = renderHook(() => usePalette(), { wrapper });
    act(() => result.current.setPalette("default"));
    expect(result.current.palette).toBe("default");
    expect(window.localStorage.getItem(KEY)).toBe("default");
    expect(attr()).toBeNull();
  });

  it("stores nothing when the choice equals the pin", () => {
    window.localStorage.setItem(KEY, "aztec");
    const { result } = renderHook(() => usePalette(), { wrapper });
    expect(result.current.palette).toBe("aztec");
    act(() => result.current.setPalette("mono"));
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(attr()).toBe("mono");
  });

  it("re-applies the stored palette when the provider mounts", () => {
    window.localStorage.setItem(KEY, "solar");
    render(<PaletteProvider defaultPalette="mono">{null}</PaletteProvider>);
    expect(attr()).toBe("solar");
  });
});
