import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { SUBSCRIPTIONS } from '../../constants/subscriptions';

// ─── TYPES ─────────────────────────────────────────────────────────────────────
// Mirrors whatever shape your SUBSCRIPTIONS constant exports.
// Adjust field names here if yours differ.
interface PlanData {
  title: string;
  price: string | number;
  period?: string;
  altBilling?: string;
  features: string[];
  popular?: boolean;
  available?: boolean;
  waitlist?: boolean;
  ctaText?: string;
}

// ─── SINGLE PLAN CARD ──────────────────────────────────────────────────────────
const PlanCard = ({
  plan,
  index,
  onCta,
}: {
  plan: PlanData;
  index: number;
  onCta: () => void;
}) => {
  const isLast = index === 2;
  const featured = plan.popular ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, delay: index * 0.08 }}
      className="relative flex flex-col p-8"
      style={{
        background: featured ? '#1c1917' : 'transparent',
        borderRight: !isLast ? '1px solid #e7e5e0' : 'none',
      }}
    >
      {/* "Most popular" badge */}
      {featured && (
        <div
          className="absolute top-0 right-6 text-[9px] font-semibold tracking-[0.1em] uppercase px-3 py-1 rounded-b-[3px]"
          style={{ background: '#C49A3C', color: '#1c1917' }}
        >
          Most Popular
        </div>
      )}

      {/* Plan name */}
      <div
        className="text-[11px] font-medium tracking-[0.12em] uppercase mb-3"
        style={{ color: featured ? 'rgba(255,255,255,0.35)' : '#78716c' }}
      >
        {plan.title}
      </div>

      {/* Price */}
      <div
        className="text-[44px] font-bold leading-none mb-1 tracking-tight"
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          color: featured ? '#fff' : '#1c1917',
        }}
      >
        {typeof plan.price === 'number' ? `€ ${plan.price}` : plan.price}
      </div>

      {/* Period */}
      <div
        className="text-[12px] mb-1"
        style={{ color: featured ? 'rgba(255,255,255,0.25)' : '#a8a29e' }}
      >
        {plan.period ?? 'per month'}
      </div>
      {plan.altBilling && (
        <div
          className="text-[11px] mb-6"
          style={{ color: featured ? 'rgba(255,255,255,0.2)' : '#c4bdb5' }}
        >
          {plan.altBilling}
        </div>
      )}
      {!plan.altBilling && <div className="mb-6" />}

      {/* Divider */}
      <div
        className="h-px mb-6"
        style={{ background: featured ? 'rgba(255,255,255,0.08)' : '#e7e5e0' }}
      />

      {/* Features */}
      <ul className="flex flex-col gap-3 flex-1 mb-8">
        {plan.features.map((f: string) => (
          <li key={f} className="flex items-start gap-2.5">
            <Check
              className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
              style={{ color: '#C49A3C' }}
              strokeWidth={2.5}
            />
            <span
              className="text-[13px] leading-snug"
              style={{ color: featured ? 'rgba(255,255,255,0.45)' : '#78716c' }}
            >
              {f}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={onCta}
        className="w-full py-3 text-[12px] font-semibold tracking-[0.06em] uppercase rounded-[3px] transition-all duration-200"
        style={
          featured
            ? { background: '#C49A3C', color: '#1c1917', border: 'none' }
            : { background: 'transparent', color: '#1c1917', border: '1px solid #e7e5e0' }
        }
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          if (featured) {
            el.style.background = '#E8C97A';
          } else {
            el.style.background = '#1c1917';
            el.style.color = '#fafaf9';
            el.style.borderColor = '#1c1917';
          }
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          if (featured) {
            el.style.background = '#C49A3C';
            el.style.color = '#1c1917';
          } else {
            el.style.background = 'transparent';
            el.style.color = '#1c1917';
            el.style.borderColor = '#e7e5e0';
          }
        }}
      >
        {plan.ctaText ?? 'Get Started'}
      </button>
      {plan.waitlist && (
        <p className="text-[10px] mt-2.5 text-center" style={{ color: featured ? 'rgba(255,255,255,0.25)' : '#c4bdb5' }}>
          Sign up free — we&apos;ll email you the moment it&apos;s live.
        </p>
      )}
    </motion.div>
  );
};

// ─── SECTION ───────────────────────────────────────────────────────────────────
const SubscriptionSection = ({ onCta }: { onCta: () => void }) => {
  return (
    <section
      id="pricing"
      className="py-24 border-t scroll-mt-20"
      style={{ background: '#F7F5EF', borderColor: '#e7e5e0' }}
    >
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="mb-14">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-5 h-px" style={{ background: '#C49A3C' }} />
            <span
              className="text-[11px] font-medium tracking-[0.12em] uppercase"
              style={{ color: '#8A6A28' }}
            >
              Pricing
            </span>
          </div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5 }}
            className="text-[clamp(26px,3.5vw,44px)] font-bold leading-[1.1] tracking-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#1c1917' }}
          >
            Simple,<br />transparent pricing.
          </motion.h2>
          <p className="mt-3 text-[14px] max-w-sm" style={{ color: '#a8a29e' }}>
            Billed annually — monthly billing available at a premium.
          </p>
        </div>

        {/* Cards grid */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 border rounded-[4px] overflow-hidden"
          style={{ borderColor: '#e7e5e0' }}
        >
          {(SUBSCRIPTIONS as PlanData[]).map((plan, index) => (
            <PlanCard key={index} plan={plan} index={index} onCta={onCta} />
          ))}
        </div>

      </div>
    </section>
  );
};

export default SubscriptionSection;
