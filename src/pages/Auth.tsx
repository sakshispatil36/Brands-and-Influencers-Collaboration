// src/pages/Auth.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth,db } from "@/integrations/firebase/client";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  //onAuthStateChanged  useEffect,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield,Mail, Lock, User, Building, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const signupSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }).max(255),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
  fullName: z.string().trim().min(2, { message: "Name must be at least 2 characters" }).max(100),
  userType: z.enum(["brand", "influencer"]),
  companyName: z.string().optional(),

  profileUrl: z.string().url("Enter valid URL").optional(),
  category: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showResetForm, setShowResetForm] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [signupData, setSignupData] = useState({
    email: "",
    password: "",
    fullName: "",
    userType: "brand" as "brand" | "influencer",
    companyName: "",
    profileUrl: "",
    category: "",
  });

  const navigate = useNavigate();
  const { toast } = useToast();

//   useEffect(() => {
//   const checkUser = async () => {
//     onAuthStateChanged(auth, (user) => {
//       if (user) {
//         navigate("/dashboard");
//       }
//     });
//   };
//   checkUser();
// }, [navigate])

 const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();

  try {
    loginSchema.parse(loginData);
    setLoading(true);
    let error: { code?: string; message: string } | null = null;
    try {
      await signInWithEmailAndPassword(
        auth,
        loginData.email,
        loginData.password
      );
    } catch (err) {
      if (err instanceof Error) {
        error = {
          message: err.message,
          code: (err as { code?: string }).code,
        };
      }
    }
    if (error) {
      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
      ) {
        toast({
          title: "Login Failed",
          description: "Invalid email or password. Please try again.",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
        });
      }
      return;
    }
    toast({
      title: "Welcome back!",
      description: "Successfully logged in.",
    });

  //   navigate("/dashboard");
  // } 
  setTimeout(() => {
  navigate("/dashboard");
}, 800)} catch (err) {
    if (err instanceof z.ZodError) {
      toast({
        title: "Validation Error",
        description: err.issues?.[0]?.message ?? "Invalid input",
      });
    }
  } finally {
    setLoading(false);
  }
};

  const handlePasswordReset = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!resetEmail.trim()) {
    toast({
      title: "Error",
      description: "Please enter your email address",
    });
    return;
  }
  setLoading(true);
  let error: Error | null = null;
  try {
    await sendPasswordResetEmail(auth, resetEmail, {
      url: `${window.location.origin}/auth`,
    });
  } catch (err) {
    if (err instanceof Error) {
      error = err;
    }
  }
  if (error) {
    toast({
      title: "Error",
      description: error.message,
    });
  } else {
    toast({
      title: "Password Reset Email Sent",
      description: "Check your email for a password reset link.",
    });
    setShowResetForm(false);
    setResetEmail("");
  }
  setLoading(false);
};

  const handleSignup = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    signupSchema.parse(signupData);
    setLoading(true);
    
    let youtubeData = {
      profile_image_url: "https://ui-avatars.com/api/?name=" + signupData.fullName,
      subscribers: 0,
      engagementRate: 0,
    };

    // 🔥 FETCH REAL YOUTUBE DATA IF INFLUENCER
    if (signupData.userType === "influencer" && signupData.profileUrl) {
      try {
        const YOUTUBE_API_KEY = "AIzaSyD0k-KliG7KdPyss-GOfHYVc_mdIGPuoqM"; // paste your key

        const profileUrl = signupData.profileUrl.trim();
        let channelRes = null;

        if (profileUrl.includes("@")) {
          // Handle @username format
          const handle = profileUrl.split("@")[1]?.split("/")[0];
          const res = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${handle}&key=${YOUTUBE_API_KEY}`
          );
          channelRes = await res.json();
        } else if (profileUrl.includes("channel/")) {
          // Handle channel/ID format
          const channelId = profileUrl.split("channel/")[1]?.split("/")[0];
          const res = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`
          );
          channelRes = await res.json();
        }

        const channel = channelRes?.items?.[0];
        if (channel) {
          const stats = channel.statistics;
          const subscribers = Number(stats.subscriberCount ?? 0);
          const views = Number(stats.viewCount ?? 0);
          const videos = Number(stats.videoCount ?? 1);
          const avgViews = views / videos;
          const engagementRate = subscribers > 0
          ? Math.min(Number(((avgViews / subscribers) * 100).toFixed(2)), 100)
          : 0;

          youtubeData = {
            profile_image_url: channel.snippet.thumbnails?.high?.url || 
              "https://ui-avatars.com/api/?name=" + signupData.fullName,
            subscribers,
            engagementRate,
          };
        }
      } catch (err) {
        console.warn("YouTube fetch failed, using defaults", err);
      }
    }

    let error: { code?: string; message: string } | null = null;

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        signupData.email,
        signupData.password
      );
      const user = userCredential.user;

      await setDoc(doc(db, "profiles", user.uid), {
        full_name: signupData.fullName,
        user_type: signupData.userType,
        company_name: signupData.companyName || "",
        email: signupData.email,

        ...(signupData.userType === "brand" && {
          brand_logo: "https://via.placeholder.com/50",
          brand_description: "",
          brand_website: "https://yourbrand.com",
        }),

        ...(signupData.userType === "influencer" && {
          profileUrl: signupData.profileUrl,
          category: signupData.category,
          profile_image_url: youtubeData.profile_image_url, // ✅ REAL LOGO
          subscribers: youtubeData.subscribers,             // ✅ REAL SUBSCRIBERS
          engagementRate: youtubeData.engagementRate,       // ✅ REAL ENGAGEMENT
        }),
      });
    } catch (err) {
      if (err instanceof Error) {
        error = {
          message: err.message,
          code: (err as { code?: string }).code,
        };
      }
    }

    if (error) {
      if (error.code === "auth/email-already-in-use") {
        toast({
          title: "Signup Failed",
          description: "This email is already registered. Please login instead.",
        });
      } else {
        toast({
          title: "Error",
          description: error.message,
        });
      }
      return;
    }

    toast({
      title: "Account created!",
      description: "Successfully signed up. Logging you in...",
    });
    navigate("/dashboard");

  } catch (err) {
    if (err instanceof z.ZodError) {
      toast({
        title: "Validation Error",
        description: err.issues?.[0]?.message ?? "Invalid input",
      });
    }
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background/10 backdrop-blur-sm mb-4">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
           {/* <div className="bg-red-500 text-white p-4 mb-4">
            If this is red, Tailwind works
          </div> */}
          <h1 className="text-3xl font-bold text-primary-foreground mb-2">SecureCollab</h1>
          <p className="text-primary-foreground/80">Protect your influencer campaigns</p>
        </div>

        <Card className="shadow-glow border-border/50">
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Login or create an account to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                {!showResetForm ? (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="you@example.com"
                          className="pl-10"
                          value={loginData.email}
                          onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-10 pr-10"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        required
                      />
                      <button
                      type="button"
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Logging in..." : "Login"}
                    </Button>

                    <Button
                      type="button"
                      variant="link"
                      className="w-full text-sm"
                      onClick={() => setShowResetForm(true)}
                    >
                      Forgot password?
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handlePasswordReset} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="you@example.com"
                          className="pl-10"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Sending..." : "Send Reset Link"}
                    </Button>

                    <Button
                      type="button"
                      variant="link"
                      className="w-full text-sm"
                      onClick={() => setShowResetForm(false)}
                    >
                      Back to login
                    </Button>
                  </form>
                )}
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="John Doe"
                        className="pl-10"
                        value={signupData.fullName}
                        onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        className="pl-10"
                        value={signupData.email}
                        onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-10 pr-10"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        required
                      />
                      <button
                      type="button"
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="user-type">I am a...</Label>
                    <select
                      id="user-type"
                      className="w-full h-10 px-3 rounded-md border border-input bg-background"
                      value={signupData.userType}
                      onChange={(e) => setSignupData({ ...signupData, userType: e.target.value as "brand" | "influencer" })}
                    >
                      <option value="brand">Brand</option>
                      <option value="influencer">Influencer</option>
                    </select>
                  </div>
                  
                  {signupData.userType === "influencer" && (
                  <>
                    <div className="space-y-2">
                      <Label>YouTube Channel URL</Label>
                      <Input
                        placeholder="https://www.youtube.com/channel/..."
                        value={signupData.profileUrl}
                        onChange={(e) =>
                          setSignupData({ ...signupData, profileUrl: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Input
                        placeholder="beauty, fitness, tech..."
                        value={signupData.category}
                        onChange={(e) =>
                          setSignupData({ ...signupData, category: e.target.value })
                        }
                      />
                    </div>
                  </>
                )}

                  {signupData.userType === "brand" && (
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Company Name (Optional)</Label>
                      <div className="relative">
                        <Building className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="company-name"
                          type="text"
                          placeholder="Acme Inc."
                          className="pl-10"
                          value={signupData.companyName}
                          onChange={(e) => setSignupData({ ...signupData, companyName: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Sign Up"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center mt-6 text-sm text-primary-foreground/70">
          Protected by bank-grade security
        </p>
      </div>
    </div>
  );
};

export default Auth;
