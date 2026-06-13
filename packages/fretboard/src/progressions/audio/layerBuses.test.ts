// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { buildLayerBuses, setLayerGain } from "./layerBuses";

function fakeAudioContext() {
  const gainNodes: Array<{ gain: { value: number }; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
  const ctx = {
    createGain: () => {
      const node = {
        gain: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      gainNodes.push(node);
      return node;
    },
  } as unknown as AudioContext;
  return { ctx, gainNodes };
}

describe("layerBuses", () => {
  it("builds one GainNode per layer and connects each to the destination", () => {
    const { ctx, gainNodes } = fakeAudioContext();
    const dest = { kind: "dest" } as unknown as AudioNode;
    const buses = buildLayerBuses(ctx, dest);
    expect(Object.keys(buses).sort()).toEqual(["bass", "chord", "drums", "metronome"]);
    expect(gainNodes).toHaveLength(4);
    gainNodes.forEach((n) => expect(n.connect).toHaveBeenCalledWith(dest));
  });

  it("setLayerGain flips the targeted layer's gain", () => {
    const { ctx } = fakeAudioContext();
    const buses = buildLayerBuses(ctx, {} as AudioNode);
    setLayerGain(buses, "drums", false);
    expect(buses.drums.gain.value).toBe(0);
    setLayerGain(buses, "drums", true);
    expect(buses.drums.gain.value).toBe(1);
  });
});
