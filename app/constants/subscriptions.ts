

export const SUBSCRIPTIONS = [
    {
      title: "Free",
      price: "€0",
      period: "forever",
      available: true,
      popular: false,
      ctaText: "Get Started",
      features: [
        "Daily portfolio dashboard",
        "AI-powered portfolio insights",
        "Portfolio alerts",
        "Explicit + implicit cost tracking",
        "Guaranteed privacy"
      ]
    },
    {
      title: "Pro",
      price: "€49",
      period: "per year",
      altBilling: "or billed monthly at a premium",
      available: false,
      waitlist: true,
      popular: true,
      ctaText: "Get Notified",
      features: [
        "Advanced AI analysis models",
        "Higher-precision implicit costs (intraday data)",
        "News digest for your holdings",
        "Annual tax summary",
        "Everything in Free"
      ]
    },
    {
      title: "Advisors",
      price: "Custom",
      period: "priced per client",
      available: false,
      waitlist: true,
      popular: false,
      ctaText: "Get Notified",
      features: [
        "Manage unlimited clients",
        "AI insights & risk profiling per client",
        "AUM tracking across your book",
        "Everything in Pro"
      ]
    }
  ];
