import { Router, type IRouter } from "express";
import projectsRouter from "./projects";
import yarnStashRouter from "./yarnStash";
import catalogReviewsRouter from "./catalogReviews";
import craftsRouter from "./crafts";
import fabricStashRouter from "./fabricStash";
import sewingProjectsRouter from "./sewingProjects";
import sewingToolsRouter from "./sewingTools";
import sewingPatternsRouter from "./sewingPatterns";
import yarnToolsRouter from "./yarnTools";
import weeklyGoalRouter from "./weeklyGoal";

const router: IRouter = Router();

router.use(yarnStashRouter);
router.use(catalogReviewsRouter);
router.use(craftsRouter);
router.use(fabricStashRouter);
router.use(sewingProjectsRouter);
router.use(sewingToolsRouter);
router.use(sewingPatternsRouter);
router.use(yarnToolsRouter);
router.use(weeklyGoalRouter);
router.use(projectsRouter);

export default router;
