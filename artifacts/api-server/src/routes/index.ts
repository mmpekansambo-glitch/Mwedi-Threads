import { Router, type IRouter } from "express";
import projectsRouter from "./projects";
import yarnStashRouter from "./yarnStash";
import catalogReviewsRouter from "./catalogReviews";

const router: IRouter = Router();

router.use(yarnStashRouter);
router.use(catalogReviewsRouter);
router.use(projectsRouter);

export default router;
