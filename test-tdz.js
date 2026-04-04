async function testBlock() {
  const table = "outer";
  try {
    if (true) {
      console.log("inner uses:", table);
    }
    const table = "inner";
  } catch(e) {
    console.error("Caught:", e.message);
  }
}
testBlock();
