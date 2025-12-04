import { Router } from "express";
import { PostController } from "../controllers/post.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.post("/", auth, PostController.create);
router.get("/", auth, PostController.list);
router.put("/:id", auth, PostController.update);
router.delete("/:id", auth, PostController.delete);

export default router;
