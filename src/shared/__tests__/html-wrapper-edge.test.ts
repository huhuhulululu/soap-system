import { wrapMulti, wrapSingle } from "../html-wrapper";

describe("html-wrapper edge cases", () => {
  it("handles empty options arrays without trailing spaces", () => {
    expect(wrapSingle("value", [])).toBe(
      '<span class="ppnSelectComboSingle">value</span>',
    );
    expect(wrapMulti("value", [])).toBe(
      '<span class="ppnSelectCombo">value</span>',
    );
  });

  it("escapes special characters in options and values", () => {
    const html = wrapSingle(`A&B < "Q" 'S'`, [
      `A&B`,
      `<tag>`,
      `"quoted"`,
      `'single'`,
    ]);
    expect(html).toContain("A&amp;B|&lt;tag&gt;|&quot;quoted&quot;|&#39;single&#39;");
    expect(html).toContain(">A&amp;B &lt; &quot;Q&quot; &#39;S&#39;</span>");
  });

  it("supports empty string values", () => {
    expect(wrapSingle("", ["a", "b"])).toBe(
      '<span class="ppnSelectComboSingle a|b"></span>',
    );
    expect(wrapMulti("", ["a", "b"])).toBe(
      '<span class="ppnSelectCombo a|b"></span>',
    );
  });

  it("filters blank array items in wrapMulti values", () => {
    const html = wrapMulti(["A", "", " ", "B"], ["A", "B"]);
    expect(html).toBe('<span class="ppnSelectCombo A|B">A, B</span>');
  });
});
