import {
  createFormatWrappers,
  escapeHtmlEntities,
  wrapMulti,
  wrapSingle,
} from "../html-wrapper";

describe("html-wrapper", () => {
  it("escapeHtmlEntities escapes basic HTML entities", () => {
    expect(escapeHtmlEntities('Qi & Blood <Deficiency> "quote"')).toBe(
      "Qi &amp; Blood &lt;Deficiency&gt; &quot;quote&quot;",
    );
  });

  it("wrapSingle renders ppnSelectComboSingle with escaped option/value", () => {
    const html = wrapSingle("good", [
      "good",
      "fair",
      "Qi & Blood Deficiency",
    ]);
    expect(html).toContain('<span class="ppnSelectComboSingle ');
    expect(html).toContain(
      "good|fair|Qi &amp; Blood Deficiency",
    );
    expect(html).toContain(">good</span>");
  });

  it("wrapMulti renders ppnSelectCombo with comma-joined value", () => {
    const html = wrapMulti(
      ["Dull", "Aching"],
      ["Dull", "Aching", "Sharp"],
    );
    expect(html).toContain('<span class="ppnSelectCombo ');
    expect(html).toContain('>Dull, Aching</span>');
  });

  it("does not add trailing space when options is empty", () => {
    expect(wrapSingle("good", [])).toBe(
      '<span class="ppnSelectComboSingle">good</span>',
    );
    expect(wrapMulti(["A"], [])).toBe('<span class="ppnSelectCombo">A</span>');
  });

  it("createFormatWrappers returns text passthrough in text mode", () => {
    const wrappers = createFormatWrappers("text");
    expect(wrappers.wrapSingleIfNeeded("fair", ["good", "fair"])).toBe("fair");
    expect(wrappers.wrapMultiIfNeeded(["Dull", "Aching"], ["Dull"])).toBe(
      "Dull, Aching",
    );
  });

  it("createFormatWrappers returns wrapped spans in html mode", () => {
    const wrappers = createFormatWrappers("html");
    expect(
      wrappers.wrapSingleIfNeeded("fair", ["good", "fair"]),
    ).toContain("ppnSelectComboSingle");
    expect(
      wrappers.wrapMultiIfNeeded(["Dull", "Aching"], ["Dull", "Aching"]),
    ).toContain("ppnSelectCombo");
  });
});
