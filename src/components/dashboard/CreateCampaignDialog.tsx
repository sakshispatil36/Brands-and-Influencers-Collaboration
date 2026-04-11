import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle,} from "@/components/ui/dialog";
import {Form,FormControl,FormField,FormItem,FormLabel,FormMessage,} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { auth, db } from "@/integrations/firebase/client"; 
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const campaignSchema = z.object({
  brandName: z.string().min(2, "Brand name must be at least 2 characters"),
  title: z.string().min(3, "Title must be at least 3 characters").max(100),
  category: z.string().min(1, "Please select a category"), 
  description: z.string().min(10, "Description must be at least 10 characters").max(1000),
  budget: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Budget must be a positive number",
  }),
  requirements: z.string().max(500).optional(),
  targetInfluencerId: z.string().optional(),
});

type CampaignForm = z.infer<typeof campaignSchema>;

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CreateCampaignDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: CreateCampaignDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [brandWebsite, setBrandWebsite] = useState("");
  const { toast } = useToast();

  const form = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      brandName: "",
      title: "",
      category: "", 
      description: "",
      budget: "",
      requirements: "",
      targetInfluencerId: "",
    },
  });

  const getDomain = (url: string) => {
  try {
    const cleaned = url
      .trim()
      .replace(/(^\w+:|^)\/\//, "")   // remove http/https
      .replace(/"/g, "")              // remove quotes
      .split("/")[0];                 // get domain only

    return cleaned;
  } catch {
    return "";
  }
};

  const onSubmit = async (data: CampaignForm) => {
    setLoading(true);

    const user = auth.currentUser;

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a campaign",
      });
      setLoading(false);
      return;
    }
    let cleanUrl = brandWebsite.trim();
    cleanUrl = cleanUrl.replace(/"/g, "").replace(/\s/g, "");
    if (!cleanUrl || !cleanUrl.includes(".")) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid website",
      });
      setLoading(false);
      return;
    }
    const domain = getDomain(cleanUrl);

    const logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

    try {
      await addDoc(collection(db, "campaigns"), {
        brand_id: user.uid,
        brand_name: data.brandName,
        brand_website: cleanUrl, 
        brand_logo: logoUrl,
        title: data.title,
        category: data.category,     
        description: data.description,
        budget: Number(data.budget),
        requirements: data.requirements || null,
        target_influencer_id: data.targetInfluencerId || null,
        status: "active",
        created_at: serverTimestamp(),
      });

      toast({
        title: "Success",
        description: "Campaign created successfully!",
      });

      form.reset();
      onOpenChange(false);
      onSuccess();
      setBrandWebsite("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong";
      toast({
        title: "Error",
        description: message,
      });
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white border border-gray-200 shadow-2xl rounded-xl p-6">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">Create New Campaign</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Fill in the details for your campaign. Influencers will be able to see and apply.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="brandName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-card-foreground">Brand Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter Brand Name" {...field} className="bg-background border-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

          <div className="space-y-2">
            <FormLabel>Brand Website</FormLabel>
            <Input
              placeholder="https://amul.com"
              value={brandWebsite}
              onChange={(e) => setBrandWebsite(e.target.value)}
            />
          </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-card-foreground">Campaign Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Summer Product Launch" {...field} className="bg-background border-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="w-full border rounded px-3 py-2 bg-background"
                    >
                      <option value="">Select Category</option>
                      <option value="Food">Food</option>
                      <option value="Travel">Travel</option>
                      <option value="Beauty">Beauty</option>
                      <option value="Tech">Tech</option>
                      <option value="Fitness">Fitness</option>
                      <option value="Fashion">Fashion</option>
                      <option value="Lifestyle">Lifestyle</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-card-foreground">Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what this campaign is about..."
                      className="min-h-[100px] bg-background border-input"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="budget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-card-foreground">Budget ($)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="1000.00" {...field} className="bg-background border-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="requirements"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-card-foreground">Requirements (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any specific requirements for influencers..."
                      className="bg-background border-input"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetInfluencerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-card-foreground">Target Influencer ID (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Paste influencer ID if you want to target someone specific"
                      {...field}
                      className="bg-background border-input"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Campaign
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateCampaignDialog;
