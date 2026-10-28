import { Router, type IRouter } from "express";
import projectsRouter from "./projects";
import yarnStashRouter from "./yarnStash";
import catalogReviewsRouter from "./catalogReviews";
import craftsRouter from "./crafts";
import fabricStashRouter from "./fabricStash";
import sewingProjectsRouter from "./sewingProjects";
import sewingToolsRouter from "./sewingTools";
import yarnToolsRouter from "./yarnTools";

const router: IRouter = Router();

router.use(yarnStashRouter);
router.use(catalogReviewsRouter);
router.use(craftsRouter);
router.use(fabricStashRouter);
router.use(sewingProjectsRouter);
router.use(sewingToolsRouter);
router.use(yarnToolsRouter);
router.use(projectsRouter);

export default router;
