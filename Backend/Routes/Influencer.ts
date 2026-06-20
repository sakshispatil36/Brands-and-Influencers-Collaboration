import { Router } from "express";
import { searchInfluencers } from "../YouTubeService";

const router = Router();

router.get("/recommend", async (req, res) => {
  try {
    const category = req.query.category as string;
    const pageToken = req.query.pageToken as string;
    const result = await searchInfluencers(category, pageToken);
    return res.json(result);
    console.log("CATEGORY:", category);

    if (!category) {
      return res.status(400).json({ message: "Category required" });
    }

    const influencers = await searchInfluencers(category);

    console.log("INFLUENCERS RESULT:", influencers);

    return res.json({
      category,
      influencers
    });

  } catch (error: unknown) {

  console.error("🔥 FULL BACKEND ERROR:", error); // ✅ ADD HERE

  if (error instanceof Error) {
    return res.status(500).json({
      message: "Backend API failed",
      error: error.message
    });
  }

  return res.status(500).json({
    message: "Unknown error occurred"
  });
}
});

export default router;