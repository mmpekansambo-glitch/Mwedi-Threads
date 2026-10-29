// Scenario: Amara crochets and knits and only uses the Yarn studio. The steps
// run in order and build on each other, the way one maker's weeks in the app
// would: stash, tools, projects, notes, renames, finishing, the Archive.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { scenarioDatabaseUrl, startScenario, stopAtFirstFailure, type Json, type Maker, type Scenario } from "./scenarioServer";

describe.skipIf(!scenarioDatabaseUrl)("Scenario: a maker who works in the Yarn studio", () => {
  let scenario: Scenario;
  let amara: Maker;
  let neighbour: Maker;
  const yarn: Record<string, Json> = {};
  let throw_: Json;
  let hat: Json;

  async function stashPhoto(maker: Maker): Promise<string> {
    const upload = await maker.post("/yarn-stash/photo-upload", { name: "skein.jpg", contentType: "image/jpeg", size: 120_000 });
    expect(upload.status).toBe(200);
    return upload.body.photoPath;
  }

  async function stash(maker: Maker, query = ""): Promise<Json[]> {
    const list = await maker.get(`/yarn-stash${query}`);
    expect(list.status).toBe(200);
    return list.body;
  }

  stopAtFirstFailure();

  beforeAll(async () => {
    scenario = await startScenario();
    amara = scenario.maker("scenario-yarn-amara");
    neighbour = scenario.maker("scenario-yarn-neighbour");
  }, 60_000);

  afterAll(async () => {
    await scenario?.stop();
  });

  it("signs up and picks the Yarn studio", async () => {
    const first = await amara.get("/me/crafts");
    expect(first.body).toEqual({ yarn: true, sewing: false, needsChoice: true });

    const chosen = await amara.put("/me/crafts", { yarn: true, sewing: false });
    expect(chosen.status).toBe(200);
    expect(chosen.body).toEqual({ yarn: true, sewing: false, needsChoice: false });
  });

  it("fills the stash with yarn, each with its own photo", async () => {
    const add = async (key: string, details: object) => {
      const response = await amara.post("/yarn-stash", { photoPath: await stashPhoto(amara), ...details });
      expect(response.status).toBe(201);
      yarn[key] = response.body;
    };
    await add("fisherman", {
      brand: "lion brand", subBrand: "Wool-Ease", color: "Fisherman", generalColor: "cream",
      weight: "worsted", blend: [{ fiber: "Acrylic", percent: 80 }, { fiber: "Wool", percent: 20 }],
      skeinsPurchased: 4,
    });
    await add("cranberry", {
      brand: "lion brand", subBrand: "Wool-Ease", color: "Cranberry", generalColor: "red",
      weight: "worsted", skeinsPurchased: 2, skeinsLeft: 2,
    });
    await add("oatmeal", { brand: "Caron", subBrand: "Simply Soft", color: "Oatmeal", weight: "worsted", skeinsPurchased: 3 });

    // Skeins left starts at skeins purchased when the maker leaves it empty.
    expect(yarn.fisherman).toMatchObject({ skeinsPurchased: 4, skeinsLeft: 4, archivedAt: null });
    expect(await stash(amara)).toHaveLength(3);

    // A yarn without a photo isn't saved.
    const noPhoto = await amara.post("/yarn-stash", { brand: "Caron", photoPath: "" });
    expect(noPhoto.status).toBe(400);
    expect(noPhoto.body.error).toBe("Add a photo of this yarn.");
  });

  it("finds yarn in the stash by brand, color or fiber", async () => {
    expect((await stash(amara, "?search=cranberry")).map((row) => row.id)).toEqual([yarn.cranberry.id]);
    expect(await stash(amara, "?search=wool")).toHaveLength(2);
    expect(await stash(amara, "?generalColor=cream")).toHaveLength(1);
  });

  it("gets a 'Did you mean' when a brand is typed a little differently", async () => {
    const catalog = await amara.get(`/yarn-catalog?brand=${encodeURIComponent("Lion Brnd")}`);
    expect(catalog.status).toBe(200);
    expect(catalog.body.suggestions.brand).toBe("lion brand");
  });

  it("fixes the spelling of a brand and the fix sticks (#79)", async () => {
    // Only the capitals change, so it's the same catalog brand: before #79 the
    // old spelling came back from the catalog and the rename didn't stick.
    const fixed = await amara.patch(`/yarn-stash/${yarn.fisherman.id}`, { brand: "Lion Brand" });
    expect(fixed.status).toBe(200);
    expect(fixed.body.brand).toBe("Lion Brand");
    expect((await amara.get(`/yarn-stash/${yarn.fisherman.id}`)).body.brand).toBe("Lion Brand");

    // The catalog now offers the corrected spelling only.
    const catalog = await amara.get("/yarn-catalog?brand=lion");
    expect(catalog.body.brands).toEqual(["Lion Brand"]);

    // Then the nudge: rename the brand on the rest of the stash. Colors stay.
    const renamed = await amara.post("/yarn-stash/rename-all", { field: "brand", from: "lion brand", to: "Lion Brand" });
    expect(renamed.body).toEqual({ renamed: 1 });
    const cranberry = (await amara.get(`/yarn-stash/${yarn.cranberry.id}`)).body;
    expect(cranberry).toMatchObject({ brand: "Lion Brand", subBrand: "Wool-Ease", color: "Cranberry" });
  });

  it("adds hooks, needles and notions to the Tools page", async () => {
    const hook = await amara.post("/yarn-tools", { section: "hooks", size: "5.0 mm (US H-8, UK/Canada 6)", material: "ergonomic", quantity: 1 });
    expect(hook.status).toBe(201);
    const needles = await amara.post("/yarn-tools", {
      section: "needles", size: "4.0 mm (US 6, UK/Canada 8)", needleType: "circular", cableLength: "80 cm (32 in)", material: "bamboo",
    });
    expect(needles.status).toBe(201);
    const markers = await amara.post("/yarn-tools", { section: "notions", notionType: "stitch_markers", quantity: 20, brand: "Clover" });
    expect(markers.status).toBe(201);

    const tools = await amara.get("/yarn-tools");
    expect(tools.body).toHaveLength(3);
    expect((await neighbour.get("/yarn-tools")).body).toHaveLength(0);
  });

  it("starts a throw using two stash yarns held together", async () => {
    const created = await amara.post("/projects", {
      title: "Cabled throw", craft: "crochet", status: "in_progress",
      startedAt: "2026-09-01", hookSize: "5.0 mm (US H-8, UK/Canada 6)",
      yarns: [
        { stashYarnId: yarn.fisherman.id, skeinsUsed: 3 },
        { stashYarnId: yarn.cranberry.id, skeinsUsed: 1, heldTogether: true },
      ],
    });
    expect(created.status).toBe(201);
    throw_ = created.body;
    expect(throw_.yarns).toHaveLength(2);
    expect(throw_.yarns[0]).toMatchObject({ stashYarnId: yarn.fisherman.id, brand: "Lion Brand", color: "Fisherman", heldTogether: false });
    expect(throw_.yarns[1]).toMatchObject({ stashYarnId: yarn.cranberry.id, heldTogether: true });
  });

  it("starts a hat with a yarn typed in, which goes into the stash too", async () => {
    const created = await amara.post("/projects", {
      title: "Slouchy hat", craft: "knitting", status: "in_progress", startedAt: "2026-10-01",
      yarns: [{ brand: "caron", subBrand: "simply soft", color: "oatmeal", skeinsUsed: 1 }],
    });
    expect(created.status).toBe(201);
    hat = created.body;
    // Typed differently, it still links to the Caron already in the stash.
    expect(hat.yarns[0]).toMatchObject({ stashYarnId: yarn.oatmeal.id, brand: "Caron", subBrand: "Simply Soft", color: "Oatmeal" });
    expect(await stash(amara)).toHaveLength(3);
  });

  it("keeps a progress journal, editing and deleting notes", async () => {
    const first = await amara.post(`/projects/${throw_.id}/progress`, { notes: "First cable panel done", completionPercent: 20 });
    expect(first.status).toBe(201);
    const second = await amara.post(`/projects/${throw_.id}/progress`, { notes: "Second panel", completionPercent: 40 });
    expect(second.status).toBe(201);

    const edited = await amara.patch(`/projects/${throw_.id}/progress/${first.body.id}`, { notes: "First cable panel done, blocked it" });
    expect(edited.status).toBe(200);
    expect(edited.body.notes).toBe("First cable panel done, blocked it");

    expect((await amara.del(`/projects/${throw_.id}/progress/${second.body.id}`)).status).toBe(204);
    const project = (await amara.get(`/projects/${throw_.id}`)).body;
    expect(project.progress.map((entry: Json) => entry.notes)).toEqual(["First cable panel done, blocked it"]);
    // Progress follows the latest note left.
    expect(project.completionPercent).toBe(20);
  });

  it("counts rows on the project counter", async () => {
    const counted = await amara.put(`/projects/${throw_.id}/counter`, { count: 42 });
    expect(counted.status).toBe(200);
    expect((await amara.get(`/projects/${throw_.id}`)).body.counter).toBe(42);
  });

  it("renames a color in the stash and the projects using it follow (#79)", async () => {
    const renamed = await amara.patch(`/yarn-stash/${yarn.cranberry.id}`, { color: "Cranberry Red" });
    expect(renamed.status).toBe(200);
    const project = (await amara.get(`/projects/${throw_.id}`)).body;
    expect(project.yarns[1]).toMatchObject({ stashYarnId: yarn.cranberry.id, color: "Cranberry Red" });
    // Searching projects by the new name finds it.
    const found = (await amara.get(`/projects?search=${encodeURIComponent("cranberry red")}`)).body;
    expect(found.map((row: Json) => row.id)).toEqual([throw_.id]);
  });

  it("sees both tied brands on the Overview (#81)", async () => {
    const overview = (await amara.get("/dashboard")).body;
    expect(overview).toMatchObject({ totalProjects: 2, activeProjects: 2, completedProjects: 0 });
    // One project each, so it's a tie, listed A to Z with one spelling per brand.
    expect(overview.mostUsedYarnBrands).toEqual(["Caron", "Lion Brand"]);
    expect(overview.mostUsedYarnBrandProjects).toBe(1);
  });

  it("finishes the throw and is offered the skeins left (#80)", async () => {
    const finished = await amara.patch(`/projects/${throw_.id}`, { status: "completed", completedAt: "2026-10-20" });
    expect(finished.status).toBe(200);
    expect(finished.body.completedAt).toBe("2026-10-20");

    const suggestions = (await amara.get(`/yarn-stash/skein-suggestions?projectId=${throw_.id}`)).body;
    expect(suggestions).toHaveLength(2);
    const fisherman = suggestions.find((row: Json) => row.stashYarnId === yarn.fisherman.id);
    const cranberry = suggestions.find((row: Json) => row.stashYarnId === yarn.cranberry.id);
    expect(fisherman).toMatchObject({ skeinsUsed: 3, skeinsLeft: 4, suggestedLeft: 1, projectTitle: "Cabled throw" });
    expect(cranberry).toMatchObject({ skeinsUsed: 1, skeinsLeft: 2, suggestedLeft: 1 });

    const accepted = await amara.post(`/yarn-stash/skein-suggestions/${fisherman.id}/accept`);
    expect(accepted.body.skeinsLeft).toBe(1);
    expect((await amara.post(`/yarn-stash/skein-suggestions/${cranberry.id}/dismiss`)).status).toBe(204);
    expect((await amara.get("/yarn-stash/skein-suggestions")).body).toHaveLength(0);
    expect((await amara.get(`/yarn-stash/${yarn.cranberry.id}`)).body.skeinsLeft).toBe(2);

    const overview = (await amara.get("/dashboard")).body;
    expect(overview).toMatchObject({ activeProjects: 1, completedProjects: 1, averageDaysToFinish: 49 });
  });

  it("buys more of a yarn and can't have more left than bought (#80)", async () => {
    // The form raises skeins left with skeins purchased; the server saves both.
    const more = await amara.patch(`/yarn-stash/${yarn.fisherman.id}`, { skeinsPurchased: 6, skeinsLeft: 3 });
    expect(more.body).toMatchObject({ skeinsPurchased: 6, skeinsLeft: 3 });

    const tooMany = await amara.patch(`/yarn-stash/${yarn.fisherman.id}`, { skeinsLeft: 7 });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error).toBe("Skeins left can't be more than skeins purchased.");
  });

  it("uses up a yarn, moves it to the Archive and gets it back by adding it again (#82)", async () => {
    const usedUp = await amara.patch(`/yarn-stash/${yarn.oatmeal.id}`, { skeinsLeft: 0 });
    expect(usedUp.body.skeinsLeft).toBe(0);
    const archived = await amara.patch(`/yarn-stash/${yarn.oatmeal.id}`, { archived: true });
    expect(archived.status).toBe(200);
    expect(archived.body.archivedAt).not.toBeNull();

    expect((await stash(amara)).map((row) => row.id)).not.toContain(yarn.oatmeal.id);
    expect((await stash(amara, "?archived=true")).map((row) => row.id)).toEqual([yarn.oatmeal.id]);
    // Archived yarn still counts on the Overview: the hat still uses Caron.
    expect((await amara.get("/dashboard")).body.mostUsedYarnBrands).toEqual(["Caron", "Lion Brand"]);

    // Buying it again, typed a little differently, brings the same yarn back.
    const again = await amara.post("/yarn-stash", {
      photoPath: await stashPhoto(amara), brand: "CARON", subBrand: "Simply Soft", color: "oatmeal", skeinsPurchased: 2,
    });
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ id: yarn.oatmeal.id, restored: true, archivedAt: null, skeinsLeft: 2 });
    expect(await stash(amara, "?archived=true")).toHaveLength(0);
  });

  it("reopens the throw and finishing it again offers skeins again", async () => {
    const reopened = await amara.patch(`/projects/${throw_.id}`, { status: "in_progress" });
    expect(reopened.body.completedAt).toBeNull();
    const refinished = await amara.patch(`/projects/${throw_.id}`, { status: "completed" });
    expect(refinished.body.status).toBe("completed");
    // Already answered for this project, so nothing new is offered.
    expect((await amara.get("/yarn-stash/skein-suggestions")).body).toHaveLength(0);
  });

  it("keeps everything private from another maker", async () => {
    expect(await stash(neighbour)).toHaveLength(0);
    expect((await neighbour.get(`/projects/${throw_.id}`)).status).toBe(404);
    expect((await neighbour.patch(`/yarn-stash/${yarn.fisherman.id}`, { color: "Mine now" })).status).toBe(404);
    expect((await neighbour.get("/dashboard")).body.totalProjects).toBe(0);
  });
});
