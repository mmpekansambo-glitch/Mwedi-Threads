import { Router, type IRouter } from "express";
import projectsRouter from "./projects";

const router: IRouter = Router();

router.use(projectsRouter);

export default router;
