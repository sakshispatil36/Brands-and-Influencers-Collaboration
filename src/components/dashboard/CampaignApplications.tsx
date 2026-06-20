import { useState, useEffect } from "react";
import { db } from "@/integrations/firebase/client";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Check, X, MessageSquare } from "lucide-react";
import MessagingPanel from "./MessagingPanel";
import { generateContractPDF } from "../../services/contractService";
import { onSnapshot } from "firebase/firestore";

export interface Application {
  id: string;
  status: string;
  message: string;
  created_at: Date; 
  influencer_id: string;
  signature_url?: string | null;  
  profiles?: InfluencerProfile;
}

interface CampaignApplicationsProps {
  campaignId: string;
  campaignTitle: string;
  brandName: string;  
}

type InfluencerProfile = {
  full_name: string;
  bio?: string;
  company_name?: string;
  subscribers?: number;
  category?: string;
  engagementRate?: number;
  profile_image_url?: string;
  profileUrl?: string;
};

const CampaignApplications = ({ campaignId, campaignTitle, brandName }: CampaignApplicationsProps) => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedInfluencer, setSelectedInfluencer] = useState<InfluencerProfile | null>(null);
  const [selectedChat, setSelectedChat] = useState<{ id: string; name: string } | null>(null);
  const [contractsMap, setContractsMap] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Helper function to fetch profile
  const getProfile = async (influencerId: string) => {
  if (!influencerId) return undefined;

  const profileSnap = await getDoc(doc(db, "profiles", influencerId));
  if (!profileSnap.exists()) return undefined;

  const data = profileSnap.data();

  return {
    full_name: data.full_name || "",
    bio: data.bio || "",
    company_name: data.company_name || "",
    subscribers: Number(data.subscribers ?? data.followers ?? 0),
    category: data.category || "",
    engagementRate: data.engagementRate || 0,
    profile_image_url: data.profile_image_url || "",
    profileUrl: data.profileUrl || "",
  };
};

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "campaign_applications"),
        where("campaign_id", "==", campaignId),
        //orderBy("applied_at", "desc")
      );
      const snapshot = await getDocs(q);

      const apps: Application[] = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const profile = await getProfile(data.influencer_id);
          return {
            id: docSnap.id,
            status: data.status,
            message: data.message,
            created_at: data.applied_at?.toDate?.() ?? new Date(),
            influencer_id: data.influencer_id,
            profiles: profile,
            signature_url: data.signature_url || null, 
          };
        })
      );

      setApplications(apps);
    } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong";

    toast({
      title: "Error",
      description: message,
    });
  } finally {
    setLoading(false);
  }
};


  const handleStatusUpdate = async (applicationId: string, newStatus: "approved" | "rejected") => {
    try {
      const applicationRef = doc(db, "campaign_applications", applicationId);
      await updateDoc(applicationRef, { status: newStatus });

      toast({
        title: "Success",
        description: `Application ${newStatus} successfully!`,
      });

      fetchApplications();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      toast({
        title: "Error",
        description: message,
      });
    }
  };

  useEffect(() => {
  const contractQuery = query(
    collection(db, "contracts"),
    where("campaign_id", "==", campaignId)
  );

  const unsubscribe = onSnapshot(contractQuery, (snapshot) => {
    const contractData: Record<string, string> = {};

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.signature_url && data.influencer_id) {
        contractData[data.influencer_id] = data.signature_url;
      }
    });

    setContractsMap(contractData); // 👈 MUST BE HERE
  });

  return () => unsubscribe();
}, [campaignId]);


useEffect(() => {
  fetchApplications();
}, [campaignId]);


const formatSubscribers = (num?: number) => {
  if (!num) return "0";

  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(".0", "") + "M";
  }

  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(".0", "") + "K";
  }

  return num.toString();
};

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-card-foreground">Applications for {brandName}</CardTitle>
        <CardDescription className="text-muted-foreground">
          {applications.length} application(s) received
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {applications.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No applications yet</p>
        ) : (
          applications.map((app) => (
            <Card key={app.id} className="bg-background border-border">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                    <img
                      src={app.profiles?.profile_image_url || "https://ui-avatars.com/api/?name=" + (app.profiles?.full_name || "U")}
                      className="w-8 h-8 rounded-full"
                    />
                    <CardTitle
                      className="text-base text-blue-600 cursor-pointer hover:underline"
                      onClick={() => setSelectedInfluencer(app.profiles ?? null)}
                    >
                      {app.profiles?.full_name || "Unnamed Influencer"}
                    </CardTitle>
                  </div>
                    <CardDescription className="text-muted-foreground">
                      {app.profiles?.company_name || ""}
                    </CardDescription>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      app.status === "approved"
                        ? "bg-green-500/20 text-green-600"
                        : app.status === "rejected"
                        ? "bg-red-500/20 text-red-600"
                        : "bg-yellow-500/20 text-yellow-600"  }`}>
                    {app.status}
                  </span>
                </div>
                
              </CardHeader>
              <CardContent className="space-y-4">

                {app.profiles?.bio && (
                  <p className="text-sm text-muted-foreground">{app.profiles.bio}</p>
                )}
                {app.message && (
                  <div>
                    <h5 className="text-sm font-semibold text-card-foreground mb-1">Message:</h5>
                    <p className="text-sm text-muted-foreground">{app.message}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  {app.status === "applied" && (
                    <>
                      <Button
                        disabled={loading}
                        size="sm"
                        onClick={() => handleStatusUpdate(app.id, "approved")}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleStatusUpdate(app.id, "rejected")}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                    setSelectedChat(
                      selectedChat?.id === app.influencer_id
                        ? null
                        : { id: app.influencer_id, name: app.profiles?.full_name || "Influencer" }
                    )
                  }
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />
                      {selectedChat?.id === app.influencer_id ? "Hide Messages" : "Message"}
                  </Button>
                </div>
               {app.status === "approved" && (
                <div className="flex items-center gap-3 mt-2 flex-wrap">

                  {/* Generate Contract */}
                  <Button
                    size="sm"
                    onClick={() => {
                      const url = generateContractPDF({
                        brandName: "Your Brand",
                        influencerName: app.profiles?.full_name || "Influencer",
                        campaignTitle: campaignTitle,
                        paymentTerms: "₹20,000 after campaign completion",
                        deliverables: "3 Instagram posts + 2 stories",
                        timeline: "Campaign duration: 15 days",
                        cancellationPolicy: "Either party can cancel with 7 days notice",
                      });

                      window.open(url, "_blank");
                    }}
                  >
                    Generate Contract
                  </Button>

                  {/* View Uploaded Signature */}
                  {contractsMap[app.influencer_id] && (
                    <>
                      <div className="flex flex-col gap-2">

                      <img
                        src={contractsMap[app.influencer_id]}
                        alt="Signature"
                        className="h-20 border rounded"
                      />

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const signature = contractsMap[app.influencer_id];

                          if (!signature) {
                            alert("Signature not found");
                            return;
                          }

                          const win = window.open("", "_blank");

                          if (win) {
                            win.document.write(`
                              <html>
                                <head>
                                  <title>Signature</title>
                                </head>
                                <body style="display:flex;justify-content:center;align-items:center;height:100vh;">
                                  <img src="${signature}" style="max-width:90%;max-height:90%;" />
                                </body>
                              </html>
                            `);
                          }
                        }}
                      >
                        View Full Signature
                      </Button>

                    </div>

                      <span className="text-green-600 text-sm font-medium">
                        ✅ Contract Signed
                      </span>
                    </>
                  )}

                </div>
              )}
              </CardContent>
            </Card>
          ))
        )}
        {selectedChat && (
        <MessagingPanel
          campaignId={campaignId}
          receiverId={selectedChat.id}
          receiverName={selectedChat.name}
        />
      )}

        {selectedInfluencer && (
  <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">

    <Card className="p-6 w-96 bg-white shadow-xl rounded-xl">

      <div className="flex flex-col items-center">
        <img
          src={selectedInfluencer.profile_image_url || "https://via.placeholder.com/60"}
          className="w-16 h-16 rounded-full mb-3"
        />

        <h2 className="text-xl font-bold">
          {selectedInfluencer.full_name}
        </h2>

        <a
          href={selectedInfluencer.profileUrl || "#"}
          target="_blank"
          className="text-blue-500"
        >
          View Profile
        </a>
      </div>

      <div className="mt-4 text-sm space-y-1">
        <p><b>Subscribers:</b> {formatSubscribers(selectedInfluencer.subscribers)}</p>
        <p><b>Category:</b> {selectedInfluencer.category}</p>
        <p><b>Engagement:</b> {(selectedInfluencer.subscribers || 0) < 1000 ? "N/A" : Math.min(selectedInfluencer.engagementRate || 0, 100).toFixed(2) + "%"}</p>
      </div>

      <Button
        className="mt-4 w-full"
        onClick={() => setSelectedInfluencer(null)}
      >
        Close
      </Button>

    </Card>
  </div>
)}
        
      </CardContent>
    </Card>
  );
};

export default CampaignApplications;
