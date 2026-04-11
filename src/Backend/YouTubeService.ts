// import type { Influencer } from "../types/influencer";
// import fetch from "node-fetch";


// // ===== TYPES =====
// interface SearchItem {
//   id: {
//     channelId: string;
//   };
//   snippet: {
//     channelTitle: string;
//     description: string;
//   };
// }

// interface YouTubeSearchResponse {
//   items: SearchItem[];
// }

// interface ChannelStatistics {
//   subscriberCount?: string;
//   viewCount?: string;
//   videoCount?: string;
// }

// interface ChannelItem {
//   id: string;
//   statistics: ChannelStatistics;
// }

// interface YouTubeChannelResponse {
//   items: ChannelItem[];
// }

// // ===== FORMAT FUNCTION =====
// function formatFollowers(count: number): string {
//   if (count >= 1_000_000) return (count / 1_000_000).toFixed(1) + "M";
//   if (count >= 1_000) return (count / 1_000).toFixed(1) + "K";
//   return count.toString();
// }

// // ===== MAIN FUNCTION =====
// export async function searchInfluencers(category: string): Promise<Influencer[]> {
//   try {
//     console.log("API HIT");
//     console.log("CATEGORY:", category);

//     const API_KEY = process.env.YOUTUBE_API_KEY;

//     console.log("👉 API KEY (inside function):", API_KEY);

//     if (!API_KEY) {
//       throw new Error("YouTube API key is missing");
//     }

//     // 🔹 1. SEARCH CHANNELS
//     const searchRes = await fetch(
//       `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${category}&maxResults=10&key=${API_KEY}`
//     );

//     if (!searchRes.ok) {
//       const errText = await searchRes.text();
//       console.error("❌ Search API error:", errText);
//       throw new Error("Search API failed");
//     }

//     const searchData = (await searchRes.json()) as YouTubeSearchResponse;

//     console.log("SEARCH DATA:", searchData);

//     if (!searchData.items || searchData.items.length === 0) {
//       console.error("❌ No search results from YouTube");
//       return [];
//     }

//     // 🔹 2. EXTRACT CHANNEL IDS
//     const channelIds = searchData.items
//       .map(item => item.id?.channelId)
//       .filter(Boolean)
//       .join(",");

//     console.log("CHANNEL IDS:", channelIds);

//     if (!channelIds) {
//       console.error("❌ No valid channel IDs found");
//       return [];
//     }

//     // 🔹 3. GET CHANNEL STATS
//     const channelRes = await fetch(
//       `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelIds}&key=${API_KEY}`
//     );

//     if (!channelRes.ok) {
//       const errText = await channelRes.text();
//       console.error("❌ Channel API error:", errText);
//       throw new Error("Channel API failed");
//     }

//     const channelData = (await channelRes.json()) as YouTubeChannelResponse;

//     // 🔹 4. MAP STATS
//     const statsMap: Record<string, ChannelStatistics> = {};

//     channelData.items.forEach(channel => {
//       statsMap[channel.id] = channel.statistics;
//     });

//     // 🔹 5. BUILD FINAL DATA
//     const influencers: Influencer[] = searchData.items.map(item => {
//       const channelId = item.id.channelId;
//       const stats = statsMap[channelId];

//       const subscribers = Number(stats?.subscriberCount ?? 0);
//       const views = Number(stats?.viewCount ?? 0);
//       const videos = Number(stats?.videoCount ?? 1);

//       const avgViews = views / videos;

//       const engagementRate =
//         subscribers > 0 ? (avgViews / subscribers) * 100 : 0;

//       let status: "Normal" | "Trusted" | "Suspicious" = "Normal";

//       if (engagementRate >= 6) status = "Trusted";
//       else if (engagementRate < 2) status = "Suspicious";

//       return {
//         id: channelId,
//         name: item.snippet.channelTitle,
//         subscribers,
//         subscribersCount: formatFollowers(subscribers),
//         category: [category],
//         bio: item.snippet.description || "",
//         location: "Unknown",
//         engagementRate: Number(engagementRate.toFixed(2)),
//         suspicious: status === "Suspicious",
//         status
//       };
//     });

//     console.log("✅ FINAL INFLUENCERS:", influencers);

//     return influencers;

//   } catch (error) {
//     console.error("❌ FULL ERROR:", error);
//     throw error; // 🔥 important for debugging
//   }
// }


import type { Influencer } from "../types/influencer";
import fetch from "node-fetch";

// ===== TYPES =====
interface SearchItem {
  id: {
    channelId: string;
  };
  snippet: {
    channelTitle: string;
    description: string;
  };
}

interface ChannelStatistics {
  subscriberCount?: string;
  viewCount?: string;
  videoCount?: string;
}

interface ChannelItem {
  id: string;
  statistics: ChannelStatistics;
  snippet: {
    thumbnails: {
      default: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
  };
}

interface YouTubeChannelResponse {
  items: ChannelItem[];
}
interface YouTubeSearchResponse {
  items: SearchItem[];
  nextPageToken?: string;
}

// ===== FORMAT FUNCTION =====
function formatFollowers(count: number): string {
  if (count >= 1_000_000) return (count / 1_000_000).toFixed(1) + "M";
  if (count >= 1_000) return (count / 1_000).toFixed(1) + "K";
  return count.toString();
}

// ===== MAIN FUNCTION =====
export async function searchInfluencers(category: string,pageToken?: string): Promise<{influencers: Influencer[];nextPageToken?: string;}> {
  try {
    console.log("API HIT");
    console.log("CATEGORY:", category);

    const API_KEY = process.env.YOUTUBE_API_KEY;

    console.log("👉 API KEY (inside function):", API_KEY);

    if (!API_KEY) {
      throw new Error("YouTube API key is missing");
    }

    const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${category}&maxResults=50&key=${API_KEY}${
      pageToken ? `&pageToken=${pageToken}` : ""
    }`
  );

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    console.error("❌ Search API error:", errText);
    throw new Error("Search API failed");
  }

  const searchData = (await searchRes.json()) as YouTubeSearchResponse;

  const items = searchData.items;
  const nextPageToken = searchData.nextPageToken;
    if (!items || items.length === 0) {
      console.error("❌ No search results");
      return {
        influencers: [],
        nextPageToken
      };
    }
    // 🔹 EXTRACT CHANNEL IDS
    const channelIds = items
      .map(item => item.id?.channelId)
      .filter(Boolean)
      .join(",");

    console.log("CHANNEL IDS:", channelIds);

    if (!channelIds) {
      console.error("❌ No valid channel IDs found");
       return {
        influencers: [],
        nextPageToken
      };
    }

    // 🔹 GET CHANNEL STATS
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIds}&key=${API_KEY}`
    );

    if (!channelRes.ok) {
      const errText = await channelRes.text();
      console.error("❌ Channel API error:", errText);
      throw new Error("Channel API failed");
    }

    const channelData = (await channelRes.json()) as YouTubeChannelResponse;

    // 🔹 MAP STATS
    const statsMap: Record<string, ChannelStatistics> = {};

    channelData.items.forEach(channel => {
      statsMap[channel.id] = channel.statistics;
    });

    // 🔹 BUILD FINAL DATA
    const influencers: Influencer[] = items.map(item => {
      const channelId = item.id.channelId;

      const stats = statsMap[channelId];
      const channelInfo = channelData.items.find(c => c.id === channelId);
      const image = channelInfo?.snippet?.thumbnails?.high?.url || "";
    
      const subscribers = Number(stats?.subscriberCount ?? 0);
      const views = Number(stats?.viewCount ?? 0);
      console.log("SUBS:", stats?.subscriberCount);
      console.log("VIEWS:", stats?.viewCount);
      const videos = Number(stats?.videoCount ?? 1);

      const avgViews = views / videos;

      const engagementRate =
        subscribers > 0 ? (avgViews / subscribers) * 100 : 0;

      let status: "Normal" | "Trusted" | "Suspicious" = "Normal";

      if (engagementRate >= 6) status = "Trusted";
      else if (engagementRate < 2) status = "Suspicious";

      return {
        id: channelId,
        name: item.snippet.channelTitle,
        subscribers,
        subscribersFormatted: formatFollowers(subscribers),
        category: [category],
        bio: item.snippet.description || "",
        location: "Unknown",
        engagementRate: Number(engagementRate.toFixed(2)),
        suspicious: status === "Suspicious",
        status,
        image,
        profileUrl: `https://www.youtube.com/channel/${channelId}`
      };
    });

    console.log("✅ FINAL INFLUENCERS:", influencers.length);

    return{ 
    influencers,
    nextPageToken
    };
  } catch (error) {
    console.error("❌ FULL ERROR:", error);
    throw error;
  }
}