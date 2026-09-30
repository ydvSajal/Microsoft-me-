import { generateText } from "ai";
import { describe, expect, it } from "vitest";
import { mockModel } from "./mock";

describe("mockModel", () => {
  it("replays responses in order, repeating the last", async () => {
    const model = mockModel(["first", "second"]);
    const texts = [];
    for (let i = 0; i < 3; i++) texts.push((await generateText({ model, prompt: "hi" })).text);
    expect(texts).toEqual(["first", "second", "second"]);
    expect(model.doGenerateCalls).toHaveLength(3);
  });
});
