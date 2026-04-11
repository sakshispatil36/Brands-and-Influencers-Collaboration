// InfluencerDashboard.tsx
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Briefcase, TrendingUp, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { SidebarProvider } from "@/components/ui/sidebar";
import DashboardSidebar from "./DashboardSidebar";
import ProfileSettings from "./ProfileSettings";
import {collection,query,where,getDocs,orderBy,addDoc,DocumentData,serverTimestamp} from "firebase/firestore";
import { db, auth} from "@/integrations/firebase/client";
import MessagingPanel from "./MessagingPanel";
import { generateContractPDF } from "../../services/contractService";
import { doc, setDoc } from "firebase/firestore";
import { onSnapshot } from "firebase/firestore";

interface Campaign {
  id: string;
  brand_name?: string;
  brand_logo?: string;
  brand_website?: string;
  title: string;
  description: string;
  budget: number;
  requirements: string;
  brand_id: string;
  profiles: {
  company_name: string;
  full_name: string;
  };
}

interface Application {
  campaign_id: string;
  status: string;
}

interface Deal {
  amount: number;
  status: string;
}


const InfluencerDashboard = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [earnings, setEarnings] = useState(0);
  const [applications, setApplications] = useState<Map<string, Application>>(new Map());
  const [selectedCampaign, setSelectedCampaign] = useState<{id: string, brandId: string, brandName: string} | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [contractsMap, setContractsMap] = useState<Record<string, string>>({});
  const { toast } = useToast();

 const fetchData = async () => {
  const user = auth.currentUser;
  if (!user) return;
  const userId = user.uid;
  try {
    // 1️⃣ Fetch confirmed deals to calculate earnings
    const dealsRef = collection(db, "deals");
    const dealsQuery = query(
      dealsRef,
      where("influencer_id", "==", userId),
      where("status", "==", "applied")
    );
    const dealsSnap = await getDocs(dealsQuery);
    let totalEarnings = 0;
    dealsSnap.forEach((doc) => {
      const data = doc.data() as Deal;
      totalEarnings += Number(data.amount) || 0;
    });
    setEarnings(totalEarnings);

    // 2️⃣ Fetch active campaigns
    const campaignsRef = collection(db, "campaigns");
    const campaignsQuery = query(
      campaignsRef,
      orderBy("created_at", "desc")
    );
    const campaignsSnap = await getDocs(campaignsQuery);
    const campaignsData: Campaign[] = await Promise.all(
      campaignsSnap.docs.map(async (doc) => {
        const data = doc.data() as DocumentData;
        // Optional: Fetch profile info if stored in a separate collection
        let profiles = { company_name: "", full_name: "" };
        if (data.brand_id) {
          const profileSnap = await getDocs(
            query(collection(db, "profiles"), where("brand_id", "==", data.brand_id))
          );
          if (!profileSnap.empty) {
            const profileData = profileSnap.docs[0].data();
            profiles = {
              company_name: profileData.company_name || "",
              full_name: profileData.full_name || "",
            };
          }
        }
        return {
          id: doc.id,
          brand_name: data.brand_name || "",  
          brand_logo: data.brand_logo ?? "",
          brand_website: data.brand_website ?? "", 
          title: data.title || "",
          description: data.description || "",
          budget: Number(data.budget) || 0,
          requirements: data.requirements || "",
          brand_id: data.brand_id || "",
          profiles,
        };
      })
    );
    setCampaigns(campaignsData);

    // 3️⃣ Fetch applications for the current influencer
    const appsRef = collection(db, "campaign_applications");
    const appsQuery = query(appsRef, where("influencer_id", "==", userId));
    const appsSnap = await getDocs(appsQuery);
    const appMap = new Map<string, Application>();
    appsSnap.forEach((doc) => {
      const data = doc.data() as Application;
      if (data.campaign_id) {
        appMap.set(data.campaign_id, { campaign_id: data.campaign_id, status: data.status || "pending" });
      }
    });
    setApplications(appMap);

  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

useEffect(() => {
    fetchData();
  }, []);

  const handleApply = async (campaignId: string) => {
  const user = auth.currentUser;
  if (!user) {
  return toast({ 
  title: "Error", 
    description: "You must be logged in" });
  }
  try {
  await addDoc(collection(db, "campaign_applications"), {
  campaign_id: campaignId,
  influencer_id: user.uid,
  applied_at: serverTimestamp(),
  status: "applied",
  });

  setApplications(prev => 
    new Map(prev).set(campaignId, { 
      campaign_id: campaignId, 
      status: "applied" 
    }));
    toast({
      title: "Success",
      description: "Applied to campaign successfully!",
    });
    fetchData();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    toast({
      title: "Error",
      description: message,
    });
  }
};

useEffect(() => {
  const user = auth.currentUser;
  if (!user) return;

  const contractQuery = query(
    collection(db, "contracts"),
    where("influencer_id", "==", user.uid)
  );

  const unsubscribe = onSnapshot(contractQuery, (snapshot) => {
    const contractData: Record<string, string> = {};

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.signature_url && data.campaign_id) {
        contractData[data.campaign_id] = data.signature_url;
      }
    });

    setContractsMap(contractData);
  });

  return () => unsubscribe();
}, []);

const handleSignatureUpload = async (
  e: React.ChangeEvent<HTMLInputElement>,
  campaignId: string,
  brandId: string
) => {
  const user = auth.currentUser;
  if (!user) return;

  const file = e.target.files?.[0];
  if (!file || file.type !== "application/pdf") {
    toast({
      title: "Error",
      description: "Please upload a valid PDF file",
    });
    return;
  }

  try {
    // Create temporary URL (for demo storage)
    const fileURL = URL.createObjectURL(file);

    // Save to Firestore contracts collection
    await setDoc(doc(db, "contracts", `${campaignId}_${user.uid}`), {
      campaign_id: campaignId,
      influencer_id: user.uid,
      brand_id: brandId,
      signature_url: fileURL,
      signed_at: serverTimestamp(),
    });

    toast({
      title: "Success",
      description: "Contract signed successfully ✅",
    });

  } catch {
    toast({
      title: "Error",
      description: "Failed to upload signature",
    });
  }
};

  return (
    <>
      <Navbar />
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <DashboardSidebar
            userType="influencer"
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          <main className="flex-1 p-6 space-y-6">
            {activeTab === "dashboard" && (
              <>
                <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="bg-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-card-foreground">Total Earnings</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-card-foreground">${earnings.toFixed(2)}</div>
                      <p className="text-xs text-muted-foreground">From confirmed deals</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-card-foreground">Active Campaigns</CardTitle>
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-card-foreground">{campaigns.length}</div>
                      <p className="text-xs text-muted-foreground">Available opportunities</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-card-foreground">Applications</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-card-foreground">{applications.size}</div>
                      <p className="text-xs text-muted-foreground">Campaigns applied to</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-8">
                  <h2 className="text-2xl font-bold mb-4">Recent Earnings</h2>
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="text-card-foreground">Total Earnings</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold text-primary">${earnings.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground mt-2">From confirmed deals</p>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}

            {activeTab === "campaigns" && (
              <>
                <h1 className="text-3xl font-bold text-foreground">Available Campaigns</h1>
                <div className="space-y-8">
                  {campaigns.length === 0 ? (
                    <Card className="bg-card border-border">
                      <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground">
                          No campaigns available at the moment.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    campaigns.map((campaign) => {
                      const application = applications.get(campaign.id);
                      return (
                      <Card key={campaign.id} className="bg-card border-border">
                      <CardHeader>
                      <div className="flex justify-between items-start">

                        {/* LEFT SIDE */}
                        <div className="flex items-start gap-3">

                          {/* LOGO */}
                          <img
                            src={
                              campaign.brand_logo ||
                              `https://www.google.com/s2/favicons?domain=${campaign.brand_website}&sz=128`
                            }
                            className="w-10 h-10 rounded-full"
                            onError={(e) => {
                              e.currentTarget.src =
                                "https://www.google.com/s2/favicons?domain=google.com&sz=128";
                            }}
                          />

                          {/* TEXT COLUMN */}
                          <div className="flex flex-col">

                            {/* BRAND NAME */}
                            <p
                              className="font-bold text-blue-600 cursor-pointer hover:underline"
                              onClick={() => {
                                if (!campaign.brand_website) {
                                  alert("No website provided");
                                  return;
                                }

                                let url = campaign.brand_website.trim();
                                url = url.replace(/^https?:\/\//, "");
                                url = "https://" + url;

                                window.open(url, "_blank", "noopener,noreferrer");
                              }}
                            >
                              {campaign.brand_name}
                            </p>

                            {/* ✅ TITLE BELOW BRAND */}
                            <p className="text-sm text-muted-foreground">
                              {campaign.title}
                            </p>

                          </div>
                        </div>

                              {application && (
                               <span
                                  className={`px-2 py-1 rounded text-xs font-medium ${
                                    application.status === "approved"
                                      ? "bg-green-500/20 text-green-600"
                                      : application.status === "rejected"
                                      ? "bg-red-500/20 text-red-600"
                                      : "bg-yellow-500/20 text-yellow-600"
                                  }`}
                                >
                                  {application.status}
                                </span>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <p className="text-card-foreground">{campaign.description}</p>
                            {campaign.requirements && (
                              <div>
                                <h4 className="font-semibold text-card-foreground mb-2">Requirements:</h4>
                                <p className="text-sm text-muted-foreground">{campaign.requirements}</p>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <div className="text-lg font-bold text-primary">
                                Budget: ${Number(campaign.budget).toFixed(2)}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => handleApply(campaign.id)}
                                  disabled={!!application}
                                >
                                  {application ? `Applied (${application.status})` : "Apply Now"}
                                </Button>
                                {application && (
                                  <Button
                                    variant="outline"
                                    onClick={() => setSelectedCampaign(
                                      selectedCampaign?.id === campaign.id
                                        ? null
                                        : { 
                                            id: campaign.id, 
                                            brandId: campaign.brand_id,
                                            brandName: campaign.profiles?.company_name || "Brand"
                                          }
                                    )}
                                  >
                                    <MessageSquare className="h-4 w-4 mr-1" />
                                    {selectedCampaign?.id === campaign.id ? "Hide Messages" : "Message Brand"}
                                  </Button>
                                  )}
                              </div>
                            </div>
                             {application?.status === "approved" && (
                              <div className="flex items-center gap-3 mt-2 flex-wrap">

                                {/* Generate Contract */}
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const url = generateContractPDF({
                                      brandName: campaign.profiles?.company_name || "Brand",
                                      influencerName: campaign.profiles?.full_name || "Influencer",
                                      campaignTitle: campaign.title,
                                      paymentTerms: "₹20,000 after campaign completion",
                                      deliverables: "3 Instagram posts + 2 stories",
                                      timeline: "Campaign duration: 15 days",
                                      cancellationPolicy: "Either party can cancel with 7 days notice",
                                    });

                                    window.open(url, "_blank");
                                  }}
                                >
                                  View Contract
                                </Button>

                                {/* Upload Signature */}
                                <label>
                                  <input
                                    type="file"
                                    accept="application/pdf"
                                    hidden
                                    onChange={(e) => handleSignatureUpload(e, campaign.id, campaign.brand_id)}
                                  />
                                  <Button size="sm" variant="outline" asChild>
                                    <span>✍ Upload Signature</span>
                                  </Button>
                                </label>

                                {contractsMap[campaign.id] && (
                                  <>
                                    <a
                                      href={contractsMap[campaign.id]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-green-600 underline"
                                    >
                                      📄 View Signature
                                    </a>

                                    <span className="text-green-600 text-sm font-medium">
                                      ✅ Contract Signed
                                    </span>
                                  </>
                                )}

                          </div>
                        )}
                          </CardContent>
                          {selectedCampaign?.id === campaign.id && (
                          <MessagingPanel 
                            campaignId={selectedCampaign.id}
                            receiverId={selectedCampaign.brandId}
                            receiverName={selectedCampaign.brandName}
                          />
                        )}
                        </Card>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {activeTab === "settings" && (
              <ProfileSettings />
            )}
          </main>
        </div>
      </SidebarProvider>
    </>
  );
};

export default InfluencerDashboard;
