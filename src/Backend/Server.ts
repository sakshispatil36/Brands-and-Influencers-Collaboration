import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
console.log("🔥 ENV CHECK:", process.env.YOUTUBE_API_KEY);

import express from "express";
import cors from "cors";
import influencerRoutes from "./Routes/Influencer";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/influencers", influencerRoutes);

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});