import { collection, getDocs } from "firebase/firestore";
import { db } from "../integrations/firebase/client";
import { Influencer } from "../../Backend/types/influencer";

interface CampaignRequirement {
  category: string;
  location: string;
}

export const getRecommendedInfluencers = async (
  requirement: CampaignRequirement,
  limit: number = 10
): Promise<Influencer[]> => {

  const snapshot = await getDocs(collection(db, "influencers"));

  const influencers: Influencer[] = [];

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();

    const categories: string[] = data.category ?? [];

    // ✅ ARRAY CHECK
    if (!categories.includes(requirement.category)) return;

    const subscribers = Number(
      data.subscribers ?? data.followers ?? 0
    );
    const engagementRate = Number(data.engagementRate ?? 0);

    influencers.push({
      id: docSnap.id,
      name: data.name ?? "Unknown",
      category: categories,
      subscribers,
      location: data.location ?? "India",
      engagementRate,
      credibilityScore: 80,
      suspicious: false,
      status: "Normal",
      matchScore: subscribers / 10000,
    });
  });

  influencers.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));

  return influencers.slice(0, limit);
};