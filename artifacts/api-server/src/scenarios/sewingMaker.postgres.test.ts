// Scenario: Bisi sews and only uses the Sewing room. The steps run in order
// and build on each other: fabric stash, notions and kit, a project with its
// needle and thread, notes, finishing, the Archive and the Overview.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scenarioDatabaseUrl, startScenario, stopAtFirstFailure, type Json, type Maker, type Scenario } from "./scenarioServer";

describe.skipIf(!scenarioDatabaseUrl)("Scenario: a maker who works in the Sewing room", () => {
  let scenario: Scenario;
  let bisi: Maker;
  let neighbour: Maker;
  const fabric: Record<string, Json> = {};
  const tool: Record<string, Json> = {};
  let dress: Json;
  let skirt: Json;

  async function fabricPhoto(maker: Maker): Promise<string> {
    const upload = await maker.post("/fabric-stash/photo-upload", { name: "print.jpg", contentType: "image/jpeg", size: 200_000 });
    expect(upload.status).toBe(200);
    return upload.body.photoPath;
  }

  async function overview(): Promise<Json> {
    const response = await bisi.get("/sewing-overview");
    expect(response.status).toBe(200);
    return response.body;
  }

  stopAtFirstFailure();

  beforeAll(async () => {
    scenario = await startScenario();
    bisi = scenario.maker("scenario-sewing-bisi");
    neighbour = scenario.maker("scenario-sewing-neighbour");
  }, 60_000);

  afterAll(async () => {
    await scenario?.stop();
  });

  it("signs up and picks the Sewing room only", async () => {
    expect((await bisi.get("/me/crafts")).body.needsChoice).toBe(true);
    const chosen = await bisi.put("/me/crafts", { yarn: false, sewing: true });
    expect(chosen.body).toEqual({ yarn: false, sewing: true, needsChoice: false });
  });

  it("adds fabric to the stash, each with a print photo", async () => {
    const add = async (key: string, details: object) => {
      const response = await bisi.post("/fabric-stash", { photoPaths: [await fabricPhoto(bisi)], ...details });
      expect(response.status).toBe(201);
      fabric[key] = response.body;
    };
    await add("cotton", {
      fabricType: "cotton", construction: "woven", print: "floral", generalColor: "blue",
      unit: "meters", amount: 3, width: 145, preWashed: true, notes: "Lawn for a summer dress",
    });
    await add("jersey", { fabricType: "jersey", construction: "knit", print: "stripe", generalColor: "white", unit: "meters", amount: 2 });
    await add("linen", { fabricType: "linen", construction: "woven", print: "solid", generalColor: "green", unit: "meters", amount: 1.5 });

    expect(fabric.cotton).toMatchObject({ amount: 3, amountLeft: null, preWashed: true, photoCount: 1, archivedAt: null });
    expect((await bisi.get("/fabric-stash")).body).toHaveLength(3);
    expect((await bisi.get("/fabric-stash?search=summer")).body.map((row: Json) => row.id)).toEqual([fabric.cotton.id]);

    // Fabric needs its print photo.
    const noPhoto = await bisi.post("/fabric-stash", { fabricType: "silk", unit: "meters", photoPaths: [] });
    expect(noPhoto.status).toBe(400);
  });

  it("adds notions and kit to Tools, and tidies a brand name everywhere", async () => {
    const add = async (key: string, details: object) => {
      const response = await bisi.post("/sewing-tools", details);
      expect(response.status).toBe(201);
      tool[key] = response.body;
    };
    await add("zip", { section: "notions", category: "zip", name: "Invisible zip", quantity: 2, size: "22 cm", color: "Navy", brand: "ykk" });
    await add("buttons", { section: "notions", category: "button", name: "Shell buttons", quantity: 6, brand: "YKK" });
    await add("foot", { section: "kit", category: "presser_foot", name: "Walking foot" });

    // A notion type doesn't fit in Kit.
    expect((await bisi.post("/sewing-tools", { section: "kit", category: "zip", name: "Zip" })).status).toBe(400);

    const renamed = await bisi.post("/sewing-tools/rename-brand", { from: "ykk", to: "YKK" });
    expect(renamed.body).toEqual({ renamed: 1 });
    expect((await bisi.get(`/sewing-tools/${tool.zip.id}`)).body.brand).toBe("YKK");
  });

  it("starts a dress with stash fabric, tools, needle and thread", async () => {
    const created = await bisi.post("/sewing-projects", {
      title: "Summer dress", status: "in_progress", stage: "cut",
      patternName: "Wrap dress", patternDesigner: "Closet Core", sizeMade: "12",
      fitChanges: "Lengthened bodice 2 cm",
      needleType: "universal", needleSize: "80/12", threadColor: "blue",
      fabrics: [{ stashFabricId: fabric.cotton.id, amountUsed: 2.5 }],
      toolIds: [tool.zip.id, tool.foot.id],
    });
    expect(created.status).toBe(201);
    dress = created.body;
    expect(dress).toMatchObject({ stage: "cut", needleType: "universal", needleSize: "80/12", threadColor: "blue", completedAt: null });
    expect(dress.fabrics).toEqual([expect.objectContaining({ stashFabricId: fabric.cotton.id, amountUsed: 2.5 })]);
    expect(dress.tools.map((row: Json) => row.id)).toEqual([tool.zip.id, tool.foot.id]);

    // Only real needle sizes are saved.
    expect((await bisi.post("/sewing-projects", { title: "Tee", needleSize: "80" })).status).toBe(400);
  });

  it("plans a skirt with the linen", async () => {
    const created = await bisi.post("/sewing-projects", {
      title: "Linen skirt", fabrics: [{ stashFabricId: fabric.linen.id, amountUsed: 1 }], toolIds: [tool.buttons.id],
    });
    expect(created.status).toBe(201);
    skirt = created.body;
    expect(skirt).toMatchObject({ status: "planning", stage: "prep" });
  });

  it("edits a fabric and the project shows the change, not a copy (#83)", async () => {
    const edited = await bisi.patch(`/fabric-stash/${fabric.cotton.id}`, { notes: "Lawn, from the market in Lagos" });
    expect(edited.status).toBe(200);
    const project = (await bisi.get(`/sewing-projects/${dress.id}`)).body;
    expect(project.fabrics[0].fabric.notes).toBe("Lawn, from the market in Lagos");

    const notions = await bisi.patch(`/sewing-tools/${tool.zip.id}`, { color: "Black" });
    expect(notions.status).toBe(200);
    expect((await bisi.get(`/sewing-projects/${dress.id}`)).body.tools[0].color).toBe("Black");
  });

  it("keeps a dated notes journal, editing and deleting notes (#84)", async () => {
    const first = await bisi.post(`/sewing-projects/${dress.id}/entries`, { notes: "Cut all pieces", createdAt: "2026-10-20T10:00:00.000Z" });
    expect(first.status).toBe(201);
    const second = await bisi.post(`/sewing-projects/${dress.id}/entries`, { notes: "Bodice too short" });
    expect(second.status).toBe(201);

    const edited = await bisi.patch(`/sewing-projects/${dress.id}/entries/${second.body.id}`, { notes: "Bodice fixed after lengthening" });
    expect(edited.body.notes).toBe("Bodice fixed after lengthening");
    // A note can't be dated in the future.
    const future = await bisi.patch(`/sewing-projects/${dress.id}/entries/${first.body.id}`, { notes: "Cut all pieces", createdAt: "2099-01-01T00:00:00.000Z" });
    expect(future.status).toBe(400);
    // An empty note isn't saved.
    expect((await bisi.post(`/sewing-projects/${dress.id}/entries`, { notes: "   " })).status).toBe(400);

    const third = await bisi.post(`/sewing-projects/${dress.id}/entries`, { notes: "Oops, wrong project" });
    expect((await bisi.del(`/sewing-projects/${dress.id}/entries/${third.body.id}`)).status).toBe(204);

    const entries = (await bisi.get(`/sewing-projects/${dress.id}`)).body.entries;
    // Newest first.
    expect(entries.map((entry: Json) => entry.notes)).toEqual(["Bodice fixed after lengthening", "Cut all pieces"]);
  });

  it("sees the Overview: stages, fabric types and stash length", async () => {
    const view = await overview();
    expect(view).toMatchObject({ inProgress: 1, finished: 0, fabricPieces: 3, fabricLength: 6.5, fabricUnit: "meters" });
    expect(view.stages.find((row: Json) => row.stage === "cut").count).toBe(1);
    expect(view.fabricTypes).toEqual([
      { fabricType: "cotton", count: 1 },
      { fabricType: "jersey", count: 1 },
      { fabricType: "linen", count: 1 },
    ]);
    expect(view.recentProjects.map((row: Json) => row.title)).toEqual(["Linen skirt", "Summer dress"]);
  });

  it("finishes the dress and records the fabric left (#83)", async () => {
    const finished = await bisi.patch(`/sewing-projects/${dress.id}`, { status: "completed", stage: "finish" });
    expect(finished.body.status).toBe("completed");
    expect(finished.body.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // The finish prompt takes the amount used off what's left.
    const left = await bisi.patch(`/fabric-stash/${fabric.cotton.id}`, { amountLeft: 0.5 });
    expect(left.body).toMatchObject({ amount: 3, amountLeft: 0.5 });
    const tooMuch = await bisi.patch(`/fabric-stash/${fabric.cotton.id}`, { amountLeft: 4 });
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.error).toBe("Amount left can't be more than amount bought.");

    // The Overview counts what's still there, not what was bought.
    expect(await overview()).toMatchObject({ inProgress: 0, finished: 1, fabricPieces: 3, fabricLength: 4 });
  });

  it("uses up the jersey and moves it to the Archive (#83)", async () => {
    expect((await bisi.patch(`/fabric-stash/${fabric.jersey.id}`, { amountLeft: 0 })).body.amountLeft).toBe(0);
    const archived = await bisi.patch(`/fabric-stash/${fabric.jersey.id}`, { archived: true });
    expect(archived.body.archivedAt).not.toBeNull();

    expect((await bisi.get("/fabric-stash")).body.map((row: Json) => row.id)).not.toContain(fabric.jersey.id);
    expect((await bisi.get("/fabric-stash?archived=true")).body.map((row: Json) => row.id)).toEqual([fabric.jersey.id]);
    // Archived fabric is left out of the Overview counts.
    const view = await overview();
    expect(view).toMatchObject({ fabricPieces: 2, fabricLength: 2 });
    expect(view.fabricTypes.map((row: Json) => row.fabricType)).toEqual(["cotton", "linen"]);
  });

  it("buys the same jersey again and is asked 'Same fabric?' (#83)", async () => {
    scenario.printPhotos.lookAlike = true;
    const details = { fabricType: "jersey", construction: "knit", print: "stripe", generalColor: "white", unit: "meters", amount: 3 };
    const asked = await bisi.post("/fabric-stash", { ...details, photoPaths: [await fabricPhoto(bisi)] });
    expect(asked.status).toBe(409);
    expect(asked.body).toMatchObject({ match: { id: fabric.jersey.id }, similarPhoto: true });

    // "Yes, same fabric" brings it back out of the Archive with the new amount.
    const restored = await bisi.post("/fabric-stash", { ...details, photoPaths: [await fabricPhoto(bisi)], restoreId: fabric.jersey.id });
    expect(restored.status).toBe(200);
    expect(restored.body).toMatchObject({ id: fabric.jersey.id, restored: true, archivedAt: null, amount: 3 });
    expect((await bisi.get("/fabric-stash?archived=true")).body).toHaveLength(0);
  });

  it("buys a different striped jersey and keeps it as new fabric (#83)", async () => {
    await bisi.patch(`/fabric-stash/${fabric.jersey.id}`, { amountLeft: 0, archived: true });
    // The print photos clearly differ, so it's added without asking.
    scenario.printPhotos.lookAlike = false;
    const details = { fabricType: "jersey", construction: "knit", print: "stripe", generalColor: "white", unit: "meters", amount: 1 };
    const added = await bisi.post("/fabric-stash", { ...details, photoPaths: [await fabricPhoto(bisi)] });
    expect(added.status).toBe(201);
    expect(added.body.id).not.toBe(fabric.jersey.id);

    // When the photos can't be compared the maker is asked, and can say "add as new".
    scenario.printPhotos.lookAlike = null;
    const asked = await bisi.post("/fabric-stash", { ...details, photoPaths: [await fabricPhoto(bisi)] });
    expect(asked.status).toBe(409);
    expect(asked.body.similarPhoto).toBeNull();
    const asNew = await bisi.post("/fabric-stash", { ...details, photoPaths: [await fabricPhoto(bisi)], addAsNew: true });
    expect(asNew.status).toBe(201);
  });

  it("uses up the zips and archives them; kit never goes in the Archive (#83)", async () => {
    expect((await bisi.patch(`/sewing-tools/${tool.zip.id}`, { quantity: 0 })).body.quantity).toBe(0);
    const archived = await bisi.patch(`/sewing-tools/${tool.zip.id}`, { archived: true });
    expect(archived.body.archivedAt).not.toBeNull();
    expect((await bisi.get("/sewing-tools")).body.map((row: Json) => row.id)).not.toContain(tool.zip.id);

    const kit = await bisi.patch(`/sewing-tools/${tool.foot.id}`, { archived: true });
    expect(kit.status).toBe(400);
    expect(kit.body.error).toBe("Only notions can go in the Archive.");

    const back = await bisi.patch(`/sewing-tools/${tool.zip.id}`, { archived: false, quantity: 3 });
    expect(back.body).toMatchObject({ archivedAt: null, quantity: 3 });
  });

  it("reopens the dress, which clears its finished date", async () => {
    const reopened = await bisi.patch(`/sewing-projects/${dress.id}`, { status: "in_progress", stage: "fit" });
    expect(reopened.body).toMatchObject({ status: "in_progress", stage: "fit", completedAt: null });
    const view = await overview();
    expect(view).toMatchObject({ inProgress: 1, finished: 0 });
    expect(view.stages.find((row: Json) => row.stage === "fit").count).toBe(1);
  });

  it("turns on the Yarn studio later without losing the Sewing room", async () => {
    const both = await bisi.put("/me/crafts", { yarn: true, sewing: true });
    expect(both.body).toEqual({ yarn: true, sewing: true, needsChoice: false });
    expect((await bisi.get("/sewing-projects")).body).toHaveLength(2);
    expect((await bisi.get("/projects")).body).toHaveLength(0);
  });

  it("keeps everything private from another maker", async () => {
    expect((await neighbour.get("/fabric-stash")).body).toHaveLength(0);
    expect((await neighbour.get(`/sewing-projects/${dress.id}`)).status).toBe(404);
    expect((await neighbour.patch(`/sewing-tools/${tool.foot.id}`, { name: "Mine" })).status).toBe(404);
    // Another maker's fabric can't go on your project.
    const borrowed = await neighbour.post("/sewing-projects", { title: "Borrowed", fabrics: [{ stashFabricId: fabric.linen.id }] });
    expect(borrowed.status).toBe(400);
    expect(borrowed.body.error).toBe("Choose fabric from your stash.");
    expect((await neighbour.get("/sewing-overview")).body).toMatchObject({ fabricPieces: 0, inProgress: 0 });
    expect(skirt.id).toBeTruthy();
  });
});
