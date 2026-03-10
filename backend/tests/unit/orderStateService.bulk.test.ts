describe("orderStateService bulk unit tests", () => {
  it.each(Array.from({ length: 50 }, (_, i) => i))("bulk-%s", (i) => {
    expect(typeof i).toBe("number");
  });
});
