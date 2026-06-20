export const fetchInfluencers = async (category: string) => {
  const response = await fetch(
    `https://brands-influencer-api.onrender.com/api/influencers/recommend?category=${category}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch influencers");
  }

  return response.json();
};