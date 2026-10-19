import { Router, type IRouter } from "express";
import projectsRouter from "./projects";
import yarnStashRouter from "./yarnStash";

const router: IRouter = Router();

router.use(yarnStashRouter);
router.use(projectsRouter);

export default router;
